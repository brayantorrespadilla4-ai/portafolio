(function(){
      const historyEl = document.getElementById('history');
      const resultEl = document.getElementById('result');
      const keys = document.getElementById('keys');

      /**
       * Estado de la calculadora
       * previous: número previo
       * operator: operador pendiente ('+','-','*','/')
       * current: número actual en pantalla
       * overwrite: si true, el próximo dígito sustituye el resultado
       */
      const state = {
        previous: null,
        operator: null,
        current: '0',
        overwrite: true
      };

      const MAX_LEN = 16;

      const format = (numStr) => {
        // Evitar formateo de exponentes o cadenas no numéricas
        if (!isFinite(Number(numStr))) return 'Error';
        if (numStr === '') return '0';

        // Mantener decimales exactos sin pérdida (no usamos Intl para no agregar comas)
        // Limitar longitud visual
        if (numStr.length > 20) {
          const n = Number(numStr);
          return Number.isFinite(n) ? n.toExponential(8) : 'Error';
        }
        return numStr;
      };

      const updateDisplay = () => {
        resultEl.textContent = format(state.current);
        const hist = [state.previous, state.operator].filter(Boolean).join(' ');
        historyEl.textContent = hist;
      };

      const inputDigit = (d) => {
        if (state.overwrite) {
          state.current = d === '.' ? '0.' : d;
          state.overwrite = false;
        } else {
          if (d === '.' && state.current.includes('.')) return; // evitar doble decimal
          if (state.current.replace('-', '').length >= MAX_LEN) return; // limite
          state.current += d;
        }
        updateDisplay();
      };

      const setOperator = (op) => {
        if (!state.overwrite) {
          // Si el usuario venía escribiendo, consolidar en previous si no hay operador
          if (state.previous === null) {
            state.previous = state.current;
          } else if (state.operator) {
            // encadena operaciones
            state.previous = compute(state.previous, state.operator, state.current);
          }
        }
        state.operator = op;
        state.overwrite = true;
        updateDisplay();
      };

      const compute = (aStr, op, bStr) => {
        const a = Number(aStr);
        const b = Number(bStr);
        let res;
        switch(op){
          case '+': res = a + b; break;
          case '-': res = a - b; break;
          case '*': res = a * b; break;
          case '/': res = b === 0 ? NaN : a / b; break;
          default: return bStr;
        }
        // Redondeo suave para errores binarios
        res = Math.round((res + Number.EPSILON) * 1e12) / 1e12;
        return String(res);
      };

      const pressEquals = () => {
        if (state.operator === null || state.previous === null) return;
        const out = compute(state.previous, state.operator, state.current);
        state.current = String(out);
        state.previous = null;
        state.operator = null;
        state.overwrite = true;
        updateDisplay();
      };

      const clearAll = () => {
        state.previous = null; 
        state.operator = null; 
        state.current = '0'; 
        state.overwrite = true; 
        updateDisplay();
      };

      const backspace = () => {
        if (state.overwrite) return; // nada que borrar
        if (state.current.length <= 1 || (state.current.length === 2 && state.current.startsWith('-'))){
          state.current = '0'; state.overwrite = true;
        } else {
          state.current = state.current.slice(0, -1);
        }
        updateDisplay();
      };

      const negate = () => {
        if (state.current === '0') return; // -0 no
        state.current = state.current.startsWith('-') ? state.current.slice(1) : '-' + state.current;
        updateDisplay();
      };

      const percent = () => {
        // Comportamiento estilo iOS: si hay operador y previous, b = previous * (current/100)
        let val = Number(state.current);
        if (state.operator && state.previous !== null){
          val = Number(state.previous) * (val / 100);
        } else {
          val = val / 100;
        }
        state.current = String(val);
        updateDisplay();
      };

      const copyToClipboard = async () => {
        try{
          await navigator.clipboard.writeText(resultEl.textContent);
          flash(resultEl);
        }catch(e){
          // Ignorar errores silenciosamente
        }
      };

      const flash = (el) => {
        el.animate([
          { filter:'brightness(1)' },
          { filter:'brightness(1.7)' },
          { filter:'brightness(1)' }
        ], { duration: 300, easing:'ease' });
      };

      // Clicks
      keys.addEventListener('click', (e)=>{
        const btn = e.target.closest('button.key');
        if(!btn) return;
        const num = btn.hasAttribute('data-num') ? btn.textContent.trim() : null;
        const action = btn.getAttribute('data-action');
        const op = btn.getAttribute('data-op');

        if (num !== null){
          inputDigit(num);
        } else if (action === 'dot'){
          inputDigit('.');
        } else if (action === 'op'){
          setOperator(op);
        } else if (action === 'equals'){
          pressEquals();
        } else if (action === 'clear'){
          clearAll();
        } else if (action === 'backspace'){
          backspace();
        } else if (action === 'negate'){
          negate();
        } else if (action === 'percent'){
          percent();
        } else if (action === 'copy'){
          copyToClipboard();
        }
      });

      // Teclado
      window.addEventListener('keydown', (e)=>{
        const k = e.key;
        if (/^[0-9]$/.test(k)) { inputDigit(k); return; }
        if (k === '.') { inputDigit('.'); return; }
        if (k === '+' || k === '-' || k === '*' || k === '/') { setOperator(k); return; }
        if (k === 'Enter' || k === '=') { e.preventDefault(); pressEquals(); return; }
        if (k === 'Escape') { clearAll(); return; }
        if (k === 'Backspace') { backspace(); return; }
        if (k === '%') { percent(); return; }
      });

      // Inicializar
      updateDisplay();
})();