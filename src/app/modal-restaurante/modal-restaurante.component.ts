import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { FirebaseService } from '../services/firebase.service';
import { Restaurante } from '../interface/restaurante';

@Component({
  selector: 'app-modal-restaurante',
  standalone: true,
  imports: [IonicModule, ReactiveFormsModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Añadir restaurante</ion-title>
        <ion-buttons slot="start">
          <!-- H3 Control y libertad: salida del modal con "Cancelar" -->
          <ion-button (click)="cancelar()" [disabled]="guardando()">Cancelar</ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <!-- H3 Control y libertad: icono X para cerrar -->
          <ion-button (click)="cancelar()" [disabled]="guardando()" title="Cerrar sin guardar">
            <ion-icon slot="icon-only" name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form [formGroup]="form">

        <!-- H4 Consistencia: todos los campos con labelPlacement="stacked" -->
        <!-- H10 Ayuda: placeholders con ejemplos reales del contexto vasco -->
        <ion-item>
          <ion-input label="Nombre *" labelPlacement="stacked" placeholder="Ej: Arzak"
            formControlName="documentName"></ion-input>
        </ion-item>
        <!-- H9 Diagnóstico de errores + H5 Prevención: mensaje inline solo tras tocar el campo -->
        @if (invalido('documentName')) {
          <ion-note color="danger" class="error">El nombre es obligatorio</ion-note>
        }

        <ion-item>
          <ion-input label="Territorio *" labelPlacement="stacked" placeholder="Ej: Bizkaia"
            formControlName="territory"></ion-input>
        </ion-item>
        @if (invalido('territory')) {
          <ion-note color="danger" class="error">El territorio es obligatorio</ion-note>
        }

        <ion-item>
          <ion-input label="Localidad" labelPlacement="stacked" placeholder="Ej: Donostia-San Sebastián"
            formControlName="locality"></ion-input>
        </ion-item>

        <ion-item>
          <ion-input label="Dirección" labelPlacement="stacked" placeholder="Ej: Calle Alameda 12"
            formControlName="address"></ion-input>
        </ion-item>

        <ion-item>
          <ion-input label="Teléfono" labelPlacement="stacked" placeholder="9XXXXXXXX"
            formControlName="phone"></ion-input>
        </ion-item>
        @if (invalido('phone')) {
          <ion-note color="danger" class="error">Introduce 9 dígitos (empieza por 6 o 9)</ion-note>
        }

        <ion-item>
          <ion-input label="Web" labelPlacement="stacked" placeholder="https://..."
            formControlName="web"></ion-input>
        </ion-item>
        @if (invalido('web')) {
          <ion-note color="danger" class="error">La web debe empezar por http:// o https://</ion-note>
        }

        <!-- H10 Ayuda: el rango válido va en la etiqueta -->
        <ion-item>
          <ion-input label="Estrellas Michelin (0-3)" labelPlacement="stacked" type="number"
            formControlName="michelinStar"></ion-input>
        </ion-item>
        @if (invalido('michelinStar')) {
          <ion-note color="danger" class="error">Introduce un número entre 0 y 3</ion-note>
        }

        <ion-item>
          <ion-input label="Soles Repsol (0-3)" labelPlacement="stacked" type="number"
            formControlName="repsolSun"></ion-input>
        </ion-item>
        @if (invalido('repsolSun')) {
          <ion-note color="danger" class="error">Introduce un número entre 0 y 3</ion-note>
        }

        <!-- H5 Prevención: el botón sigue deshabilitado hasta que el formulario es válido -->
        <!-- H1 Visibilidad del estado: el botón muestra "Guardando..." con spinner -->
        <ion-button expand="block" class="ion-margin-top" [disabled]="form.invalid || guardando()"
          (click)="guardar()">
          @if (guardando()) {
            <ion-spinner name="crescent" slot="start"></ion-spinner>
            Guardando...
          } @else {
            <ion-icon slot="start" name="save-outline"></ion-icon>
            Guardar en Firebase
          }
        </ion-button>

        <!-- H5: si el usuario intenta guardar con el botón bloqueado, se le explica por qué -->
        @if (form.invalid) {
          <ion-note class="ion-padding-top" (click)="form.markAllAsTouched()">
            Rellena los campos obligatorios (*) para poder guardar.
          </ion-note>
        }
      </form>
    </ion-content>
  `,
  styles: [`
    .error { display: block; padding: 4px 16px 0; font-size: 12px; }
  `]
})
export class ModalRestauranteComponent {

  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private firebase = inject(FirebaseService);

  guardando = signal(false); // H1

  // H5 Prevención de errores: validadores en cada campo
  form = this.fb.nonNullable.group({
    documentName: ['', [Validators.required]],
    territory: ['', [Validators.required]],
    locality: [''],
    address: [''],
    phone: ['', [Validators.pattern(/^([69]\d{8})?$/)]],
    web: ['', [Validators.pattern(/^(https?:\/\/.+)?$/)]],
    michelinStar: [0, [Validators.min(0), Validators.max(3)]],
    repsolSun: [0, [Validators.min(0), Validators.max(3)]]
  });

  constructor() {
    addIcons({ closeOutline, saveOutline });
  }

  // H9: el error solo se muestra si el usuario ha tocado el campo y es inválido
  invalido(campo: string): boolean {
    const c: AbstractControl = this.form.get(campo)!;
    return c.invalid && (c.touched || c.dirty);
  }

  cancelar() {
    // H3 Control y libertad
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // H9: señala los campos incorrectos
      return;
    }

    this.guardando.set(true); // H1
    const v = this.form.getRawValue();

    const nuevo = {
      documentName: v.documentName.trim(),
      territory: v.territory.trim(),
      locality: v.locality.trim(),
      address: v.address.trim(),
      phone: v.phone.trim(),
      web: v.web.trim(),
      michelinStar: String(v.michelinStar ?? 0),
      repsolSun: String(v.repsolSun ?? 0)
    } as Restaurante;

    try {
      await this.firebase.anadir(nuevo);
      this.modalCtrl.dismiss(nuevo, 'guardado');
    } catch (error: any) {
      // H9 Reconocer y diagnosticar errores: mensaje concreto y persistente
      console.error('Error al guardar el restaurante:', error); // detalle técnico
      const detalle = error?.code ?? error?.message ?? 'desconocido';
      const msg = error?.code === 'permission-denied'
        ? 'Sin permisos en Firebase. Revisa las reglas de seguridad.'
        : error?.code === 'timeout'
          ? 'Error al guardar el restaurante: el servidor no responde. Revisa tu conexión a internet.'
          : `Error al guardar el restaurante (${detalle}). Revisa tu conexión a internet.`;
      const toast = await this.toastCtrl.create({
        message: msg, color: 'danger', position: 'bottom',
        buttons: [{ icon: 'close', role: 'cancel' }] // duration 0 por defecto: no desaparece solo
      });
      await toast.present();
    } finally {
      this.guardando.set(false);
    }
  }
}