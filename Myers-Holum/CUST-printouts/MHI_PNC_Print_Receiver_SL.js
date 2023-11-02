/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */

/**
 * Applies To: Invoice Group
 */

define(['N/record', 'N/render', 'N/search', 'N/file', 'N/xml'], (record, render, search, file, xml) => {
  function xmlFormat(data) {
    let returnData = '';

    if (data && data.length > 0) {
      returnData = xml.escape(data);
    }

    return returnData;
  }

  function onRequest(context) {
    try {
      if (context.request.method == 'GET') {
        const { request } = context;
        const params = request.parameters;
        const recID = params.id;

        const orderObj = {
          items: []
        };
        const finalObj = {
          items: []
        };
        const rec = record.load({
          type: 'purchaseorder',
          id: recID
        });
        const lines = rec.getLineCount({
          sublistId: 'item'
        });

        for (let i = 0; i < lines; i += 1) {
          const line = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'line',
            line: i
          });
          const item = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            line: i
          });
          const vendorItem = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'vendorname',
            line: i
          });
          const itemName = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'item_display',
            line: i
          });
          const description = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'description',
            line: i
          });
          const quantity = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: i
          });
          const units = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'unitsdisplay',
            line: i
          });
          const bin = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'binnumber',
            line: i
          });
          //   const overflow = rec.getSublistValue({
          //     sublistId: 'item',
          //     fieldId: 'binnumber',
          //     line: i
          //   });

          const itemObj = {
            line, vendorItem, itemName, description, quantity, units, bin, name: item
          };

          orderObj.items.push(itemObj);
        }

        log.debug('orderObj', orderObj);

        const renderer = render.create();

        renderer.addRecord({
          templateName: 'record',
          record: record.load({
            type: 'purchaseorder',
            id: recID
          })
        });
        renderer.addCustomDataSource({
          format: render.DataSource.OBJECT,
          alias: 'JSON',
          data: orderObj
        });
        const xmlTemplateFile = file.load('SuiteScripts/Myers-Holum/Print-Receiver/MHI_PNC_Receiver_Template.xml');
        renderer.templateContent = xmlTemplateFile.getContents();
        const itemLabelPdf = renderer.renderAsPdf();

        context.response.writeFile({
          file: itemLabelPdf,
          isInline: true
        });
      }
    } catch (e) {
      log.error('Rendering error', e);
      throw e;
    }
  }

  return {
    onRequest
  };
});
