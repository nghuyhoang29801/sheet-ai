function doGet(e) {

  const action = e && e.parameter
    ? e.parameter.action
    : "schema";

  if (action == "schema") {
    return getSchema();
  }

  return ContentService
    .createTextOutput(
      JSON.stringify({
        error: "unknown action"
      })
    )
    .setMimeType(ContentService.MimeType.JSON);
}

function getSchema() {

  const sheet =
    SpreadsheetApp.getActiveSpreadsheet()
      .getActiveSheet();

  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    return ContentService
      .createTextOutput(
        JSON.stringify({
          headers: []
        })
      )
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headers =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0];

  return ContentService
    .createTextOutput(
      JSON.stringify({
        headers: headers
      })
    )
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {

  const sheet =
    SpreadsheetApp.getActiveSpreadsheet()
      .getActiveSheet();

  const body =
    JSON.parse(e.postData.contents);

  // Lưu vào nhiều cột (A, B, C, D...)
  sheet.appendRow([
    new Date(),
    body.food || body.raw_text || "",
    body.total_amount || "",
    body.people_count || ""
  ]);

  return ContentService
    .createTextOutput(
      JSON.stringify({
        success: true
      })
    )
    .setMimeType(ContentService.MimeType.JSON);
}
