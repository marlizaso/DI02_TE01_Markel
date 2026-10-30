import { Component, signal, computed, inject } from '@angular/core';
import restaurantesJSON from '../../assets/datos/restaurantes.json';
import {
  IonicModule, ToastController, AlertController, LoadingController, ModalController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cloudDownloadOutline, cloudUploadOutline, addCircleOutline, trashOutline,
  closeCircleOutline, lockClosedOutline, star, sunny, globeOutline, arrowUp, arrowDown, close
} from 'ionicons/icons';
import { Restaurante } from '../interface/restaurante';
import { FirebaseService } from '../services/firebase.service';
import { ModalRestauranteComponent } from '../modal-restaurante/modal-restaurante.component';

type ColumnaOrden = '' | 'documentName' | 'locality' | 'territory' | 'michelinStar' | 'repsolSun';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonicModule],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage {

  // ############################### REGION DATOS ###############################

  private toastController = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private modalCtrl = inject(ModalController);
  private firebase = inject(FirebaseService);

  restaurantesCargados = signal<Restaurante[]>([]);
  hayDatos = computed(() => this.restaurantesCargados().length > 0);

  // H1 Visibilidad del estado: signals que indican operaciones en curso
  cargando = signal(false);
  importando = signal(false);

  // H5 Prevención de errores: bloquea botones mientras hay una operación en curso
  ocupado = computed(() => this.cargando() || this.importando());

  constructor() {
    addIcons({
      cloudDownloadOutline, cloudUploadOutline, addCircleOutline, trashOutline,
      closeCircleOutline, lockClosedOutline, star, sunny, globeOutline, arrowUp, arrowDown, close
    });
  }

  // Carga los restaurantes desde Firestore
  async cargarDatos(mostrarMensaje = true) {
    this.cargando.set(true); // H1: spinner "Cargando restaurantes..."
    try {
      const datos = await this.firebase.obtenerTodos();
      this.restaurantesCargados.set(datos);
      if (mostrarMensaje) {
        await this.mostrarToast(`${datos.length} restaurantes cargados`, 'success'); // H1
      }
    } catch (error: any) {
      await this.mostrarToast(this.mensajeError(error, 'cargar datos'), 'danger'); // H9
    } finally {
      this.cargando.set(false);
    }
  }

  // Importa el JSON local a Firestore (borra todo lo anterior)
  async importarJSON() {
    const nuevos = restaurantesJSON as unknown as Restaurante[];

    // H5 Prevención + H3 Control: confirmación indicando el impacto exacto
    const alert = await this.alertCtrl.create({
      header: 'Importar restaurantes',
      subHeader: `Se subirán ${nuevos.length} restaurantes`,
      message: 'Se borrarán TODOS los restaurantes actuales del servidor. ¿Deseas continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Importar', role: 'confirm' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    this.importando.set(true);
    // H1: overlay bloqueante que informa de cada fase
    const loading = await this.loadingCtrl.create({ message: 'Importando...' });
    await loading.present();

    try {
      await this.firebase.importar(nuevos, msg => (loading.message = msg));
      await this.cargarDatos(false);
      await this.mostrarToast(`${nuevos.length} restaurantes importados`, 'success');
    } catch (error: any) {
      await this.mostrarToast(this.mensajeError(error, 'importar los datos'), 'danger');
    } finally {
      await loading.dismiss();
      this.importando.set(false);
    }
  }

  // Abre el modal para añadir un restaurante
  async abrirModal() {
    const modal = await this.modalCtrl.create({ component: ModalRestauranteComponent });
    await modal.present();
    const { role, data } = await modal.onWillDismiss();
    if (role === 'guardado') {
      await this.cargarDatos(false);
      await this.mostrarToast(`${data.documentName} añadido correctamente`, 'success'); // H1
    }
  }

  // Borra un restaurante con confirmación y opción de deshacer
  async borrarRestaurante(r: Restaurante) {
    // H2 Coincidencia con el mundo real: se usa el nombre real del restaurante
    // H5 Prevención + H3 Control: confirmación explícita antes de borrar
    const alert = await this.alertCtrl.create({
      header: 'Borrar restaurante',
      message: `¿Deseas borrar el restaurante ${r.documentName}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Borrar', role: 'confirm', cssClass: 'alert-danger' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    // H1: overlay mientras se borra (evita pulsar dos veces)
    const loading = await this.loadingCtrl.create({ message: 'Borrando restaurante...' });
    await loading.present();

    try {
      await this.firebase.borrar(r.id!);
      this.restaurantesCargados.update(lista => lista.filter(x => x.id !== r.id));
      await loading.dismiss();
      await this.mostrarToastConDeshacer(r);
    } catch (error: any) {
      await loading.dismiss();
      // H9: el restaurante sigue en la lista, el usuario puede reintentar
      await this.mostrarToast(this.mensajeError(error, 'borrar el restaurante'), 'danger');
    }
  }

  // H3 Control y libertad: toast con botón "Deshacer" durante 6 segundos
  private async mostrarToastConDeshacer(r: Restaurante) {
    const toast = await this.toastController.create({
      message: `${r.documentName} borrado`,
      color: 'success',
      position: 'bottom',
      duration: 6000,
      buttons: [
        {
          text: 'Deshacer',
          handler: async () => {
            try {
              await this.firebase.anadir(r);
              await this.cargarDatos(false);
              await this.mostrarToast(`${r.documentName} recuperado`, 'success');
            } catch (error: any) {
              await this.mostrarToast(this.mensajeError(error, 'deshacer el borrado'), 'danger'); // H9
            }
          }
        },
        { icon: 'close', role: 'cancel' }
      ]
    });
    await toast.present();
  }

  // H1 + H4 Consistencia: todos los toasts abajo y con botón X;
  // H9: los errores no desaparecen solos (duration 0), los éxitos sí (3 s)
  private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: color === 'success' ? 3000 : 0,
      color,
      position: 'bottom',
      buttons: [{ icon: 'close', role: 'cancel' }]
    });
    await toast.present();
  }

  // H9: distingue "sin permisos" de "error de red"
  private mensajeError(error: any, accion: string): string {
    console.error(`Error al ${accion}:`, error); // detalle técnico para el desarrollador
    if (error?.code === 'permission-denied') {
      return 'Sin permisos en Firebase. Revisa las reglas de seguridad.';
    }
    if (error?.code === 'timeout') {
      return `Error al ${accion}: el servidor no responde. Revisa tu conexión a internet.`;
    }
    const detalle = error?.code ?? error?.message ?? 'desconocido';
    return `Error al ${accion} (${detalle}). Revisa tu conexión a internet.`;
  }

  // ############################### REGION FILTROS ###############################

  textoBusqueda = signal('');

  // ############################### REGION TERRITORIOS ###############################

  territorioSeleccionado = signal('');

  territoriosFiltrados = computed(() => {
    const territorios = this.restaurantesCargados()
      .map(r => r.territory?.trim())
      .filter((t): t is string => !!t);
    return Array.from(new Set(territorios)).sort();
  });

  onTerritorioChange(value: string) {
    this.territorioSeleccionado.set(value ?? '');
    const validas = this.localidadesFiltradasPorTerritorio();
    this.localidadesSeleccionadas.set(
      this.localidadesSeleccionadas().filter(l => validas.includes(l))
    );
  }

  // H3: el territorio no se puede quitar mientras haya localidades seleccionadas
  territorioBloqueado = computed(() => this.localidadesSeleccionadas().length > 0);

  quitarTerritorio() {
    if (this.territorioBloqueado()) return;
    this.territorioSeleccionado.set('');
  }

  // ############################### REGION LOCALIDADES ###############################

  localidadesSeleccionadas = signal<string[]>([]);

  localidadesFiltradasPorTerritorio = computed(() => {
    let lista = this.restaurantesCargados();
    const territorio = this.territorioSeleccionado().trim().toLowerCase();
    if (territorio) {
      lista = lista.filter(r => r.territory?.trim().toLowerCase() === territorio);
    }
    const localidades = lista.filter(r => !!r.locality?.trim()).map(r => r.locality.trim());
    return Array.from(new Set(localidades)).sort();
  });

  onLocalidadesChange(value: string[]) {
    this.localidadesSeleccionadas.set(value ?? []);
  }

  // H3 Control y libertad: quitar una localidad concreta desde su chip
  quitarLocalidad(loc: string) {
    this.localidadesSeleccionadas.update(l => l.filter(x => x !== loc));
  }

  limpiarLocalidades() {
    this.localidadesSeleccionadas.set([]);
  }

  // ############################### REGION RESULTADOS ###############################

  restaurantesFiltrados = computed(() => {
    const busqueda = this.textoBusqueda().trim().toLowerCase();
    const territorio = this.territorioSeleccionado().trim().toLowerCase();
    const localidades = this.localidadesSeleccionadas();

    return this.restaurantesCargados().filter(r => {
      const coincideBusqueda = String(r.documentName ?? '').toLowerCase().includes(busqueda);
      const coincideTerritorio = !territorio || String(r.territory ?? '').trim().toLowerCase() === territorio;
      const coincideLocalidad = localidades.length === 0 || localidades.includes(String(r.locality ?? '').trim());
      return coincideBusqueda && coincideTerritorio && coincideLocalidad;
    });
  });

  // ############################### REGION ORDENACIÓN ###############################

  // H6 Reconocimiento: la columna ordenada se ve con una flecha
  // H7 Flexibilidad: ordenar por cualquier columna
  sortColumna = signal<ColumnaOrden>('');
  sortDireccion = signal<'asc' | 'desc'>('asc');

  cambiarOrden(col: ColumnaOrden) {
    if (this.sortColumna() === col) {
      this.sortDireccion.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumna.set(col);
      this.sortDireccion.set('asc');
    }
  }

  restaurantesOrdenados = computed(() => {
    const col = this.sortColumna();
    const lista = [...this.restaurantesFiltrados()];
    if (!col) return lista;
    const factor = this.sortDireccion() === 'asc' ? 1 : -1;

    return lista.sort((a, b) => {
      if (col === 'michelinStar' || col === 'repsolSun') {
        return (Number(a[col]) - Number(b[col])) * factor;
      }
      return String(a[col] ?? '').localeCompare(String(b[col] ?? ''), 'es') * factor;
    });
  });

  // ############################### REGION AUXILIARES ###############################

  hayFiltrosActivos(): boolean {
    return this.textoBusqueda().trim() !== ''
      || this.territorioSeleccionado() !== ''
      || this.localidadesSeleccionadas().length > 0;
  }

  // H3 / H7: limpiar todos los filtros de golpe
  limpiarTodosFiltros(): void {
    this.textoBusqueda.set('');
    this.territorioSeleccionado.set('');
    this.localidadesSeleccionadas.set([]);
  }

  // Devuelve un array de n posiciones para repetir iconos en la plantilla
  rango(n: number): number[] {
    return Array.from({ length: Math.max(0, Math.min(n, 3)) }, (_, i) => i);
  }

  estrellasMichelin(r: Restaurante): number {
    const v = Number(r.michelinStar);
    return Number.isFinite(v) ? v : 0;
  }

  repsolSoles(r: Restaurante): number {
    const v = Number(r.repsolSun);
    return Number.isFinite(v) ? v : 0;
  }
}