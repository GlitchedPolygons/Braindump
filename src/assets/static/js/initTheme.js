const body = document.body;

let theme = localStorage.getItem('theme') ?? 'dark';

if (theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
}