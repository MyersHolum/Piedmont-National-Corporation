/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/runtime', 'N/record', 'N/render', 'N/email', 'N/error'], (search, runtime, record, render, email, error) => {
  function beforeSubmit(context) {
    try {
      log.debug('context type', context.type);
      const testrec = context.newRecord;
      log.debug('testrec', testrec);
      if (context.type !== 'edit' && context.type !== 'create') { return; }

      // deployed on SO and PO
      const rec = context.newRecord;
      log.debug('rec', rec);

      const vendor = rec.getValue({
        fieldId: 'entity'
      });

      const lines = rec.getLineCount({
        sublistId: 'item'
      });
      const items = [];
      const rates = [];
      for (let i = 0; i < lines; i += 1) {
        const item = rec.getSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: i
        });
        const rate = rec.getSublistValue({
          sublistId: 'item',
          fieldId: 'rate',
          line: i
        }) || 0;
        if (rec.type == 'purchaseorder') {
          log.debug('update purch');
          updateItem(item, vendor, rate);
        } else {
          items.push(item);
          rates.push(rate);
        }
      }

      if (rec.type == 'salesorder') {
        // itempricing;
        const custRec = record.load({
          type: 'customer',
          id: vendor,
          isDynamic: true
        });
        const itemLines = custRec.getLineCount({
          sublistId: 'itempricing'
        });
        for (let i = 0; i < items.length; i += 1) {
          const itemID = items[i];
          const rate = rates[i];
          const lineNumber = custRec.findSublistLineWithValue({
            sublistId: 'itempricing',
            fieldId: 'item',
            value: itemID
          });
          log.debug('lineNumber of customer rec update', lineNumber);
          if (lineNumber != -1) {
            const currentRate = custRec.getSublistValue({
              sublistId: 'itempricing',
              fieldId: 'price',
              line: lineNumber
            });
            if (currentRate == rate) { continue; }

            const lineNum = custRec.selectLine({
              sublistId: 'itempricing',
              line: lineNumber
            });
            custRec.setCurrentSublistValue({
              sublistId: 'itempricing',
              fieldId: 'level',
              value: -1,
              ignoreFieldChange: true
            });
            custRec.setCurrentSublistValue({
              sublistId: 'itempricing',
              fieldId: 'price',
              value: rate,
              ignoreFieldChange: true
            });

            custRec.commitLine({
              sublistId: 'itempricing'
            });
          } else {
            log.debug('add new item on cust rec', itemLines);
            log.debug('new price', rate);
            const lineNum = custRec.selectNewLine({
              sublistId: 'itempricing'
            });
            custRec.setCurrentSublistValue({
              sublistId: 'itempricing',
              fieldId: 'item',
              value: itemID,
              ignoreFieldChange: true
            });
            custRec.setCurrentSublistValue({
              sublistId: 'itempricing',
              fieldId: 'level',
              value: -1,
              ignoreFieldChange: true
            });
            custRec.setCurrentSublistValue({
              sublistId: 'itempricing',
              fieldId: 'price',
              value: rate,
              ignoreFieldChange: true
            });

            custRec.commitLine({
              sublistId: 'itempricing'
            });
          }
        }

        custRec.save();
      }
    } catch (e) {
      log.error('Error in updating so', e.toString());
    }
  }

  function updateItem(item, vendor, rate) {
    log.debug('item', item);
    log.debug('vendor', vendor);
    log.debug('rate', rate);

    const itemSearchObj = search.create({
      type: 'item',
      filters:
        [
          ['internalid', 'anyof', item],
          'AND',
          ['othervendor', 'anyof', vendor]
        ],
      columns:
        [
          search.createColumn({
            name: 'itemid',
            sort: search.Sort.ASC
          }),
          'displayname',
          'salesdescription',
          'type',
          'baseprice',
          'type',
          'cost'
        ]
    });
    const searchResultCount = itemSearchObj.runPaged().count;
    log.debug('searchResultCount for exiting vendor on item rec', searchResultCount);

    if (searchResultCount > 0) {
      itemSearchObj.run().each((result) => {
        log.debug('result for exiting vendor on item rec', result);

        // .run().each has a limit of 4,000 results
        const itemType = result.recordType;
        const itemRec = record.load({
          type: itemType,
          id: result.id
        });
        const totalLines = itemRec.getLineCount({
          sublistId: 'itemvendor'
        });
        const lineNumber = itemRec.findSublistLineWithValue({
          sublistId: 'itemvendor',
          fieldId: 'vendor',
          value: vendor
        });
        log.debug('lineNumber of item rec update', lineNumber);

        if (lineNumber != -1) {
          itemRec.setSublistValue({
            sublistId: 'itemvendor',
            fieldId: 'purchaseprice',
            line: lineNumber,
            value: rate
          });
        } else {
          itemRec.setSublistValue({
            sublistId: 'itemvendor',
            fieldId: 'vendor',
            line: totalLines,
            value: vendor
          });
          itemRec.setSublistValue({
            sublistId: 'itemvendor',
            fieldId: 'purchaseprice',
            line: totalLines,
            value: rate
          });
        }

        itemRec.save();

        return true;
      });
    } else {
      const itemSearch = search.create({
        type: 'item',
        filters:
        [
          ['internalid', 'anyof', item]
        ],
        columns:
        [
          search.createColumn({
            name: 'itemid',
            sort: search.Sort.ASC
          }),
          'displayname',
          'salesdescription',
          'type'
        ]
      });
      itemSearch.run().each((result) => {
        // .run().each has a limit of 4,000 results
        log.debug('result for basic item search', result);

        // .run().each has a limit of 4,000 results
        const itemType = result.recordType;
        const itemRec = record.load({
          type: itemType,
          id: result.id,
          isDynamic: true
        });
        // const totalLines = itemRec.getLineCount({
        //   sublistId: 'itemvendor'
        // });
        // itemRec.setSublistValue({
        //   sublistId: 'itemvendor',
        //   fieldId: 'vendor',
        //   line: totalLines,
        //   value: vendor
        // });
        // itemRec.setSublistValue({
        //   sublistId: 'itemvendor',
        //   fieldId: 'purchaseprice',
        //   line: totalLines,
        //   value: rate
        // });
        const lineNum = itemRec.selectNewLine({
          sublistId: 'itemvendor'
        });
        itemRec.setCurrentSublistValue({
          sublistId: 'itemvendor',
          fieldId: 'vendor',
          value: vendor
        });
        itemRec.setCurrentSublistValue({
          sublistId: 'itemvendor',
          fieldId: 'purchaseprice',
          value: rate
        });
        itemRec.commitLine({
          sublistId: 'itemvendor'
        });
        itemRec.save();
        return true;
      });

      /*
     itemSearchObj.id="customsearch1695083989848";
     itemSearchObj.title="Custom Item Search 3 (copy)";
     var newSearchId = itemSearchObj.save();
     */
    }
  }


  return {
    beforeSubmit
  };
});
