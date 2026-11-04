// ===== DÁN VÀO CUỐI FILE "Code" CỦA V19 =====
// Chuyển toàn bộ dữ liệu học sinh V19 sang Thời khoá biểu v2. Chạy 1 lần trong trình soạn thảo (nút Chạy).
// An toàn: chỉ chủ dự án chạy được; không xoá gì ở V19; chạy lại không ghi đè dữ liệu đã chuyển.
function chuyenDuLieuSangV2() {
  if (Session.getActiveUser().getEmail() !== 'vtcc2009@gmail.com') throw Error('Chỉ chủ dự án được chạy');
  var URL = 'https://nmh-tkb.netlify.app/api/admin/import', KHOA = '<TKB_IMPORT_TOKEN — lấy trên Netlify, project nmh-tkb>';
  var props = PropertiesService.getScriptProperties().getProperties(), fam = {}, items = [];
  Object.keys(props).forEach(function (k) { if (k.indexOf('family_') === 0) fam[k] = props[k]; });
  Object.keys(props).forEach(function (k) {
    if (k.indexOf('access_') !== 0) return;
    var code = k.slice(7), fk = key_(code);
    if (fam[fk]) { items.push({ code: code, family: fam[fk], access: JSON.parse(props[k]) }); delete fam[fk]; }
  });
  var ok = 0, skip = 0, err = [];
  for (var i = 0; i < items.length; i += 20) {
    var r = UrlFetchApp.fetch(URL, { method: 'post', contentType: 'application/json', headers: { 'x-admin-token': KHOA }, payload: JSON.stringify({ items: items.slice(i, i + 20) }), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) { err.push('HTTP ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200)); continue; }
    JSON.parse(r.getContentText()).results.forEach(function (x) { if (x.ok) ok++; else if (/Đã có/.test(x.error)) skip++; else err.push(x.code + ': ' + x.error); });
  }
  var orphan = Object.keys(fam).length;
  var msg = 'Chuyển xong: ' + ok + ' học sinh mới, ' + skip + ' đã có từ trước, ' + orphan + ' bản ghi cũ không có khoá (chưa mở lại từ V17) — không chuyển, ' + err.length + ' lỗi' + (err.length ? '\n' + err.join('\n') : '');
  Logger.log(msg);
  return msg;
}
