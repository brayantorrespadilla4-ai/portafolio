document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Evita que la página se recargue

        const username = document.getElementById('username').value;// una constante del nombre id del documento 
        const password = document.getElementById('password').value;// una cosntante de la contraseña id del documento
        alert(`¡Bienvenido, ${username}! Inicio de sesión exitoso.`); // lanza una alerta si el correo y contraseña es correcto

        loginForm.reset(); //resetea todo al inicio
    });
});