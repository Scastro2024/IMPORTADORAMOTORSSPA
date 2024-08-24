document.addEventListener('DOMContentLoaded', function () {
    var loginForm = document.getElementById('loginForm');
    var errorMessage = document.getElementById('errorMessage');
    var credentials = [];

    // Cargar el archivo Excel desde GitHub
    fetch('https://scastro2024.github.io/credencialesimportadoramotors/CREDENCIALES.xlsx')
        .then(response => response.arrayBuffer())
        .then(data => {
            var workbook = XLSX.read(data, { type: 'array' });
            var sheet = workbook.Sheets[workbook.SheetNames[0]];
            credentials = XLSX.utils.sheet_to_json(sheet);
        })
        .catch(error => {
            console.error('Error al cargar el archivo Excel:', error);
            errorMessage.textContent = 'No se pudieron cargar las credenciales.';
            errorMessage.classList.remove('hidden');
        });

    loginForm.addEventListener('submit', function (event) {
        event.preventDefault();

        var username = document.getElementById('username').value.trim();
        var password = document.getElementById('password').value.trim();

        var submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        if (!username || !password) {
            errorMessage.textContent = 'Por favor, complete ambos campos.';
            errorMessage.classList.remove('hidden');
            submitButton.disabled = false;
            return;
        }

        // Validar credenciales contra los datos del Excel
        var user = credentials.find(cred => cred.RUT === username && cred.CONTRASEÑA === password);

        if (user) {
            // Mostrar mensaje de bienvenida
            alert(`¡Bienvenido/a ${user.NOMBRE}!`);
            
            // Redirigir al usuario después de mostrar el mensaje
            setTimeout(function () {
                window.location.href = 'map.html';
            }, 1000); // 1 segundo de retraso para mostrar el mensaje de bienvenida
        } else {
            errorMessage.textContent = 'Rut o contraseña incorrectos.';
            errorMessage.classList.remove('hidden');
            loginForm.reset();
            submitButton.disabled = false;
        }
    });
});


