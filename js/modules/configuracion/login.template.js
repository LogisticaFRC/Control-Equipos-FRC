// Plantilla HTML del componente 'login' (extraída del index original)
export default /* html */ `
<div class="min-h-screen flex items-center justify-center bg-slate-900 p-4 w-full flex-grow">
  <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-8 space-y-6 text-center">
    <div class="flex justify-center">
      <div class="bg-slate-900 p-3 rounded-2xl w-28 h-28 flex items-center justify-center border border-slate-700 shadow-xl">
        <img :src="logoSrc" @error="onLogoError" referrerpolicy="no-referrer" alt="Logo Empresa" class="max-h-full max-w-full object-contain">
      </div>
    </div>
    <div>
      <h2 class="text-xl font-extrabold text-slate-800 tracking-tight">{{ config.title }}</h2>
      <p class="text-xs text-slate-500 mt-1 font-semibold">{{ config.subtitle }}</p>
    </div>
    <form @submit.prevent="login" class="space-y-4 text-left text-xs">
      <div>
        <label class="font-bold text-slate-700 block mb-1">Usuario</label>
        <div class="relative">
          <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400"><i class="fa-solid fa-user"></i></span>
          <input type="text" v-model="loginUser" placeholder="Ingresa tu usuario..." required class="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800 outline-none">
        </div>
      </div>
      <div>
        <label class="font-bold text-slate-700 block mb-1">Contraseña</label>
        <div class="relative">
          <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400"><i class="fa-solid fa-lock"></i></span>
          <input type="password" v-model="loginPass" placeholder="Ingresa tu contraseña..." required class="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800 outline-none">
        </div>
      </div>
      <p v-if="avisoSesion && !authError" class="text-amber-700 font-bold text-center bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs">
        <i class="fa-solid fa-clock mr-1"></i> {{ avisoSesion }}
      </p>
      <p v-if="authError" class="text-rose-600 font-bold text-center bg-rose-50 p-3 rounded-xl border border-rose-200 text-xs">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i> Usuario o contraseña incorrectos
      </p>
      <button type="submit" :style="primaryBtnStyle" class="w-full font-extrabold py-3.5 rounded-xl shadow-lg hover:brightness-110 transition flex items-center justify-center gap-2 text-sm uppercase tracking-wider">
        <i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión
      </button>
    </form>
    <div class="text-[11px] text-slate-400 font-medium">Acceso protegido - Sistema Operativo FRC · <span class="text-slate-300">v{{ APP_VERSION }}</span></div>
  </div>
</div>
`;
