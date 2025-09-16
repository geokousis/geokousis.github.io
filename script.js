// Terminal-style theme toggle for dark/light mode
(function() {
  const btn = document.getElementById('toggle-theme');
  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };
  // Initial theme
  const userTheme = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (userTheme) setTheme(userTheme);
  else if (systemDark) setTheme('dark');
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
})();
