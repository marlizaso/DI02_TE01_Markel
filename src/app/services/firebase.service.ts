import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore, collection, getDocs, addDoc, deleteDoc, doc, writeBatch, Firestore
} from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { Restaurante } from '../interface/restaurante';

@Injectable({ providedIn: 'root' })
export class FirebaseService {

  // Fuerza el modo "long polling": soluciona el caso de
  // redes, VPN o bloqueadores que dejan la conexión de Firestore colgada
  private db: Firestore = initializeFirestore(
    initializeApp(environment.firebaseConfig),
    { experimentalForceLongPolling: true }
  );
  private readonly NOMBRE_COLECCION = 'restaurantes';

  // Solo se suben los campos que usa la app. Campos como dataXML o metadataXML pesan mucho
  // y hacían que la subida de 500 restaurantes se quedara sin respuesta
  private readonly CAMPOS = [
    'documentName', 'documentDescription', 'locality', 'address', 'phone', 'web',
    'email', 'postalCode', 'restorationType', 'michelinStar', 'repsolSun',
    'territory', 'municipality', 'country'
  ];

  private reducir(r: Restaurante): Record<string, string> {
    const origen = r as unknown as Record<string, unknown>;
    const salida: Record<string, string> = {};
    for (const campo of this.CAMPOS) {
      salida[campo] = String(origen[campo] ?? '').slice(0, 2000);
    }
    return salida;
  }

  // H9: si Firestore no responde en 15 s, se lanza un error en vez de quedarse cargando para siempre
  private conTimeout<T>(promesa: Promise<T>, ms = 15000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject({ code: 'timeout' }), ms);
      promesa.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); }
      );
    });
  }

  // Lee todos los restaurantes (guardamos el id del documento para poder borrarlo)
  async obtenerTodos(): Promise<Restaurante[]> {
    const snap = await this.conTimeout(getDocs(collection(this.db, this.NOMBRE_COLECCION)));
    return snap.docs.map(d => ({ ...(d.data() as Restaurante), id: d.id }));
  }

  // Añade un restaurante y devuelve su id
  async anadir(restaurante: Restaurante): Promise<string> {
    const { id, ...datos } = restaurante; // el id lo genera Firestore
    const ref = await this.conTimeout(addDoc(collection(this.db, this.NOMBRE_COLECCION), datos));
    return ref.id;
  }

  // Borra un restaurante por su id
  async borrar(id: string): Promise<void> {
    await this.conTimeout(deleteDoc(doc(this.db, this.NOMBRE_COLECCION, id)));
  }

  // Borra todo lo que hay y sube la lista recibida (por lotes de 20, con reintentos)
  async importar(restaurantes: Restaurante[], progreso?: (mensaje: string) => void): Promise<void> {
    progreso?.('Borrando datos...');
    const existentes = await this.conTimeout(getDocs(collection(this.db, this.NOMBRE_COLECCION)));
    await this.ejecutarPorLotes(existentes.docs.map(d => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)));

    progreso?.('Subiendo restaurantes...');
    const colRef = collection(this.db, this.NOMBRE_COLECCION);
    // Los ids se generan una sola vez: si un lote se reintenta, escribe los mismos documentos y no duplica
    const refs = restaurantes.map(() => doc(colRef));

    // H1: el mensaje del overlay indica cuántos restaurantes se han subido ya
    await this.ejecutarPorLotes(restaurantes.map((r, i) => (b: ReturnType<typeof writeBatch>) => {
      b.set(refs[i], this.reducir(r));
    }), n => progreso?.(`Subiendo restaurantes... ${n} de ${restaurantes.length}`));
  }

  private async ejecutarPorLotes(
    ops: ((b: ReturnType<typeof writeBatch>) => void)[],
    alTerminarLote?: (hechos: number) => void
  ) {
    const TAM = 25;
    for (let i = 0; i < ops.length; i += TAM) {
      const grupo = ops.slice(i, i + TAM);
      // Hasta 3 intentos por lote antes de dar el error
      for (let intento = 1; ; intento++) {
        try {
          const batch = writeBatch(this.db);
          grupo.forEach(op => op(batch));
          await this.conTimeout(batch.commit(), 20000);
          break;
        } catch (e) {
          if (intento >= 3) throw e;
        }
      }
      alTerminarLote?.(Math.min(i + TAM, ops.length));
    }
  }
}