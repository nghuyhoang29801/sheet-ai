function doPost(e) {
  try {
    // Phân tích dữ liệu JSON nhận được từ ứng dụng web
    var data = JSON.parse(e.postData.contents);
    
    // Mở Spreadsheet hiện tại
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Lấy các giá trị (chỉnh sửa thứ tự này cho khớp với cột trong Google Sheet của bạn)
    var date = data.date || "";
    var amount = data.amount || 0;
    var category = data.category || "";
    var note = data.note || "";
    
    // Lưu vào dòng mới nhất (Append Row)
    sheet.appendRow([date, amount, category, note]);
    
    // Trả về JSON xác nhận thành công
    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Trả về thông báo lỗi nếu có
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Cần thêm hàm doGet để tránh lỗi nếu vô tình truy cập bằng trình duyệt (GET request)
function doGet(e) {
  return ContentService.createTextOutput("Sheet AI Webhook is running!");
}
