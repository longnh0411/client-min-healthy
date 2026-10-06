// Đặt theme trước khi render để không bị chớp màu (FOUC) — file tĩnh,
// được next/script (beforeInteractive) inject vào head ngoài cây React.
(function () {
  try {
    var t = localStorage.getItem("theme");
    var d = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", d);
  } catch (e) {}
})();
