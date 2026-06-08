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

  let logText = "";
  if (body.raw_text) {
    logText = `[${new Date().toLocaleString('vi-VN')}]: ${body.raw_text}`;
  }

  sheet.appendRow([logText]);

  return ContentService
    .createTextOutput(
      JSON.stringify({
        success: true
      })
    )
    .setMimeType(ContentService.MimeType.JSON);
}
