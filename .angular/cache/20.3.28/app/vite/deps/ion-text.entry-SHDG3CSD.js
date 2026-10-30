import {
  createColorClasses
} from "./chunk-BN7CDWP5.js";
import {
  getIonMode
} from "./chunk-SYNBK4OD.js";
import {
  Host,
  h,
  registerInstance
} from "./chunk-Y7EDMSAH.js";
import "./chunk-VKXDQDEG.js";

// node_modules/@ionic/core/dist/esm/ion-text.entry.js
var textCss = () => `:host(.ion-color){color:var(--ion-color-base)}`;
var Text = class {
  constructor(hostRef) {
    registerInstance(this, hostRef);
  }
  render() {
    const mode = getIonMode(this);
    return h(Host, { key: "bfaa49d35f43b8036725ae8a322c716fc6e43bdf", class: createColorClasses(this.color, {
      [mode]: true
    }) }, h("slot", { key: "c04880cd1935b42cbe60f58fd523b4d8a96072dc" }));
  }
};
Text.style = textCss();
export {
  Text as ion_text
};
//# sourceMappingURL=ion-text.entry-SHDG3CSD.js.map
