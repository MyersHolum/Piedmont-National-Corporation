/**
 *@NApiVersion 2.1
*@NScriptType ClientScript
*/

define(['N/currentRecord', 'N/url'], (currentRecord, url) => {
  function pageInit() {}

  function printLabel() {
    const currentId = currentRecord.get().id;
    let suiteletURL = url.resolveScript({
      scriptId: 'customscript_mhi_pnc_print_labels_sl',
      deploymentId: 'customdeploy_mhi_pnc_print_labels_sl'
    });
    suiteletURL += '&id=' + currentId + '&type=label';
    const schedpdf = window.open(suiteletURL);
    schedpdf.document.title = 'Print Label PDF';
  }

  return {
    pageInit,
    printLabel
  };
});
