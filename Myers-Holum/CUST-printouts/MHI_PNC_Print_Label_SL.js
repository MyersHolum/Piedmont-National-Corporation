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

  function getUPC(itemName) {
    let upc = '';
    const itemSearchObj = search.create({
      type: 'item',
      filters:
        [
          ['name', 'haskeywords', itemName]
        ],
      columns:
        [
          search.createColumn({
            name: 'itemid',
            sort: search.Sort.ASC
          }),
          'type',
          'upccode'
        ]
    });
    const searchResultCount = itemSearchObj.runPaged().count;
    log.debug('itemSearchObj result count', searchResultCount);
    itemSearchObj.run().each((result) => {
      // .run().each has a limit of 4,000 results
      const upccode = result.getValue({
        name: 'upccode'
      });
      upc = upccode;
      return true;
    });
    return upc;
  }

  function ifSpecial(SOid, itemName) {
    const custObj = {};
    const SO = record.load({
      type: 'salesorder',
      id: SOid
    });
    const lineNumber = SO.findSublistLineWithValue({
      sublistId: 'item',
      fieldId: 'item_display',
      value: itemName
    });
    const isSpecial = SO.getSublistValue({
      sublistId: 'item',
      fieldId: 'createpo',
      line: lineNumber
    });
    log.debug('createpo: isSpecial', isSpecial);
    if (isSpecial == 'SpecOrd') {
      const customer = SO.getValue({
        fieldId: 'entity'
      }); // defaultaddress
      const tranid = SO.getValue({
        fieldId: 'tranid'
      });
      const customerName = SO.getText({
        fieldId: 'entity'
      });
      const custLookup = search.lookupFields({
        type: search.Type.CUSTOMER,
        id: customer,
        columns: ['address']
      });
      const { address } = custLookup;
      custObj.customer = customerName;
      custObj.address = address;
      custObj.tranid = tranid;
    }

    return custObj;
  }

  function onRequest(context) {
    try {
      if (context.request.method == 'GET') {
        const { request } = context;
        const params = request.parameters;
        const { headers } = request;
        const link = headers.referer;
        const recID = params.id;
        log.debug('recID', recID);
        log.debug('params', params);
        log.debug('request', request);
        log.debug('context', context);
        log.debug('link', link);
        let recType = 'purchaseorder';
        if (link.includes('itemrcpt')) { recType = 'itemreceipt'; }

        //  if (link.includes('salesord')) { recType = 'salesorder'; }

        log.debug('recType', recType);

        const orderObj = {
          items: []
        };
        const finalObj = {
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
          let location = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'location_display',
            line: i
          });
          let locationVal = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            line: i
          });
          let WSHE = '';
          if (locationVal) {
            const wsheSearch = search.lookupFields({
              type: search.Type.LOCATION,
              id: locationVal,
              columns: 'custrecord_5826_loc_branch_id'
            });
            log.debug('wsheSearch', wsheSearch);
            if (wsheSearch) {
              WSHE = wsheSearch.custrecord_5826_loc_branch_id;
            }
          }

          let itemName = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'itemname',
            line: i
          });
          let units = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'unitsdisplay',
            line: i
          }); // custcol_mhi_labels_to_print
          const repeatLabels = Number(rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_mhi_labels_to_print',
            line: i
          }));
          if (recType == 'purchaseorder') {
            itemName = rec.getSublistValue({
              sublistId: 'item',
              fieldId: 'item_display',
              line: i
            });
            location = rec.getText({
              fieldId: 'location'
            });
            locationVal = rec.getValue({
              fieldId: 'location'
            });
            if (locationVal) {
              const wsheSearch = search.lookupFields({
                type: search.Type.LOCATION,
                id: locationVal,
                columns: 'custrecord_5826_loc_branch_id'
              });
              log.debug('wsheSearch on po ', wsheSearch);
              if (wsheSearch) {
                WSHE = wsheSearch.custrecord_5826_loc_branch_id;
              }
            }

            units = rec.getSublistValue({
              sublistId: 'item',
              fieldId: 'units_display',
              line: i
            });
          }

          // const barcode = getUPC(itemName);
          const description = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'description',
            line: i
          });
          const quantity = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: i
          }); // createdfrom
          let createdPO = rec.getText({
            fieldId: 'createdfrom'
          });
          const createdPOval = rec.getValue({
            fieldId: 'createdfrom'
          });
          log.debug('createdPOval', createdPOval);

          let POCreationDate = rec.getValue({
            fieldId: 'createddate'
          });
          let address = '';
          let customerName = '';
          let salesOrderID = '';
          const index = createdPO.indexOf('#PO');
          if (createdPO.includes('Purchase Order') && (recType == 'itemreceipt')) {
            const purchaseOrderLookup = search.lookupFields({
              type: search.Type.PURCHASE_ORDER,
              id: createdPOval,
              columns: ['datecreated', 'createdfrom']
            });
            POCreationDate = purchaseOrderLookup.datecreated;
            createdPO = createdPO.substring(index + 1);
            log.debug('createdPO', createdPO);
            log.debug('purchaseOrderLookup', purchaseOrderLookup);

            const SOid = purchaseOrderLookup.createdfrom;
            log.debug('purchaseOrderLookup SOid', SOid);
            log.debug('purchaseOrderLookup SOid.length', SOid.length);

            if (SOid.length !== 0) {
              const SO = SOid[0].value;
              log.debug('SOid', SOid);
              log.debug('SO', SO);

              log.debug('itemName', itemName);

              const specialOrder = ifSpecial(SO, itemName);
              log.debug('specialOrder', specialOrder);

              if (specialOrder) {
                address = specialOrder.address;
                customerName = specialOrder.customerName;
                salesOrderID = specialOrder.tranid;
              }
            }
          } else if (recType == 'purchaseorder') {
            createdPO = rec.getText({
              fieldId: 'tranid'
            });

            const SOid = rec.getValue({
              fieldId: 'createdfrom'
            });
            log.debug('purchase order:: SOid', SOid);

            if (SOid !== null && SOid !== '') {
              const specialOrder = ifSpecial(SOid, itemName);
              log.debug('specialOrder', specialOrder);

              if (specialOrder) {
                address = specialOrder.address;
                customerName = specialOrder.customerName;
                salesOrderID = specialOrder.tranid;
              }
            }
          }

          log.debug('createdPOval', createdPOval);
          log.debug('createdPO', createdPO);
          const date = new Date(POCreationDate);
          const POdate = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();


          const itemObj = {
            repeatLabels, name: itemName, description, location, WSHE, quantity, units, createdPO, POdate, address, customerName, salesOrderID
          };

          // if pallet -> pallet for loop
          // (let i = 0; i < pallet.length; i +=1) {
          //     orderObj.items.push(itemObj);
          //   } else {
          orderObj.items.push(itemObj);
        // }
        }

        log.debug('orderObj', orderObj);
        const temp = orderObj.items;
        const final = [];
        for (let i = 0; i < temp.length; i += 1) {
          const object = temp[i];
          const repeat = Number(object.repeatLabels);
          if (repeat > 1) {
            for (let j = 0; j < repeat; j += 1) {
              final.push(object);
            }
          } else {
            final.push(temp[i]);
          }
        }

        finalObj.items = final;
        log.debug('finalObj', finalObj);
        log.debug('final.length', final.length);
        const JSONObj = {
          items: []
        };
        for (let i = 0; i < final.length; i += 1) {
          const object = final[i];
          const item = object.name;
          let nextItem = object.name;
          let isLast = false;
          if (i + 1 == final.length) {
            isLast = true;
          } else {
            nextItem = final[i + 1].name;
          }

          const repeat = Number(object.repeatLabels);
          const qty = object.quantity;
          let finalQty = qty;
          if (repeat > 1) {
            const tempQty = qty / repeat;
            const resultQty = Math.floor(qty / repeat);
            log.debug('resultQty', resultQty);

            const isWhole = tempQty % 1;
            log.debug('tempQty', tempQty);
            if (isWhole == 0) {
              finalQty = tempQty;
            } else if (isLast == false && (item == nextItem)) {
              const newQty = resultQty;
              log.debug('newQty floor', tempQty);
              // object.quantity = newQty;
              finalQty = newQty;
            } else {
              const remainder = qty - resultQty * repeat;
              const newQty = resultQty + remainder;
              log.debug('newQty with remainder', newQty);
              finalQty = newQty;
            }
          }

          const itemObj = {
            repeatLabels: object.repeatLabels,
            name: object.name,
            description: object.description,
            location: object.location,
            WSHE: object.WSHE,
            quantity: finalQty,
            units: object.units,
            createdPO: object.createdPO,
            POdate: object.POdate,
            address: object.address,
            customerName: object.customerName,
            salesOrderID: object.salesOrderID
          };
          log.debug('final itemObj', itemObj);

          JSONObj.items.push(itemObj);
          log.debug('final', final);
        }

        log.debug('final JSONObj', JSONObj);

        const renderer = render.create();

        renderer.addRecord({
          templateName: 'record',
          record: record.load({
            type: recType,
            id: recID
          })
        }); // logicObj
        renderer.addCustomDataSource({
          format: render.DataSource.OBJECT,
          alias: 'JSON',
          data: JSONObj
        });
        const xmlTemplateFile = file.load('SuiteScripts/Myers-Holum/Print-Labels/MHI_PNC_Label_Template.xml');
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
