// =====================================================================
// CONFIG & USUARIOS · Pantalla de inicio de sesión
// =====================================================================
import template from './login.template.js';
import { config } from '../../core/store.js';
import { avisoSesion } from '../../core/sesion.js';
import { loginUser, loginPass, authError, login, primaryBtnStyle, logoSrc, onLogoError } from './configuracion.service.js';

export default {
  name: 'LoginView',
  template,
  setup() {
    return { config, avisoSesion, loginUser, loginPass, authError, login, primaryBtnStyle, logoSrc, onLogoError };
  }
};
