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

  function itemData(itemID) {
    const itemObj = {};
    const itemSearchObj = search.create({
      type: 'item',
      filters:
        [
          ['internalidnumber', 'equalto', itemID]
        ],
      columns:
        [
          search.createColumn({
            name: 'itemid',
            sort: search.Sort.ASC
          }),
          'displayname',
          'salesdescription',
          'custitem_og_pack_size_field',
          'othervendor',
          'vendorname'
        ]
    });
    const searchResultCount = itemSearchObj.runPaged().count;
    log.debug('itemSearchObj result count', searchResultCount);
    itemSearchObj.run().each((result) => {
      // .run().each has a limit of 4,000 results
      itemObj.description = result.getValue({
        name: 'salesdescription'
      });
      itemObj.packSize = result.getValue({
        name: 'custitem_og_pack_size_field'
      });
      itemObj.vendorCode = result.getValue({
        name: 'vendorname'
      });
      return true;
    });
    return itemObj;
  }

  function onRequest(context) {
    try {
      if (context.request.method == 'GET') {
        const { request } = context;
        const params = request.parameters;
        const { headers } = request;
        const link = headers.referer;
        const recID = params.id;
        const recType = 'inventorycount';

        log.debug('recID', recID);
        log.debug('params', params);
        log.debug('request', request);
        log.debug('context', context);
        log.debug('link', link);


        const orderObj = {
          items: []
        };
        const rec = record.load({
          type: recType,
          id: recID
        });
        const lines = rec.getLineCount({
          sublistId: 'item'
        });

        for (let i = 0; i < lines; i += 1) {
          const location = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'binname',
            line: i
          });
          const itemName = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'item_display',
            line: i
          });
          const units = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'units_display',
            line: i
          });
          const itemID = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            line: i
          });
          const itemInfo = itemData(itemID);
          const { description } = itemInfo;
          const { vendorCode } = itemInfo;
          const { packSize } = itemInfo;


          const itemObj = {
            name: itemName, description, location, units, vendorCode, packSize
          };

          orderObj.items.push(itemObj);
        }

        log.debug('orderObj', orderObj);
        const temp = orderObj.items;
        log.debug('temp before', temp);

        temp.sort((a, b) => {
          if (a.location < b.location) { return -1; }

          if (a.location > b.location) { return 1; }

          return 0;
        });
        log.debug('temp after', temp);

        const finalObj = {
          items: []
        };
        finalObj.items = (temp);

        const renderer = render.create();

        renderer.addRecord({
          templateName: 'record',
          record: record.load({
            type: 'inventorycount',
            id: recID
          })
        });
        renderer.addCustomDataSource({
          format: render.DataSource.OBJECT,
          alias: 'JSON',
          data: finalObj
        });
        const xmlTemplateFile = file.load('SuiteScripts/Myers-Holum/Print-Inventory/MHI_PNC_Print_Inventory_Count_Template.xml');
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
