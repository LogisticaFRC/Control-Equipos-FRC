// =====================================================================
// CONFIG & USUARIOS · Pantalla de inicio de sesión
// =====================================================================
import template from './login.template.js';
import { config } from '../../core/store.js';
import { avisoSesion, APP_VERSION } from '../../core/sesion.js';
import { loginUser, loginPass, authError, login, primaryBtnStyle, logoSrc, onLogoError } from './configuracion.service.js';

export default {
  name: 'LoginView',
  template,
  setup() {
    return { config, avisoSesion, APP_VERSION, loginUser, loginPass, authError, login, primaryBtnStyle, logoSrc, onLogoError };
  }
};
