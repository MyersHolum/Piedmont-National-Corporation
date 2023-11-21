/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/record'], (record) => {
  function afterSubmit(context) {
    const ifId = context.newRecord.id;
    if (context.type !== 'create' && context.type !== 'edit' && context.type !== 'ship') return;

    try {
      const ifRec = record.load({
        type: 'itemfulfillment',
        id: ifId
      });

      if (context.type === 'create' || context.type === 'edit') {
        const ifStatus = ifRec.getValue('shipstatus');
        if (ifStatus !== 'C') return;
      }

      const soId = ifRec.getValue('createdfrom');
      const soRec = record.load({
        type: 'salesorder',
        id: soId
      });

      // get backordered lines and quantities
      const backorderedLines = getBackorderedLines(ifRec, soRec);
      if (backorderedLines.length == 0) return;

      // create new backorder SO
      const backorderSOId = createBackorderSO(backorderedLines, soRec, soId);
      log.audit('backorderSOId', backorderSOId);

      // close lines on original SO
      const soRecUpdatedId = closeLinesOriginalSO(backorderedLines, soRec);
      log.audit('soRecUpdatedId', soRecUpdatedId);
    } catch (e) {
      log.error('Error', `IF ID: ${ifId}: ${e}`);
    }
  }

  function getBackorderedLines(ifRec, soRec) {
    const backorderedLines = [];

    const lineCount = ifRec.getLineCount('item');

    for (let i = 0; i < lineCount; i += 1) {
      const orderLine = ifRec.getSublistValue({
        sublistId: 'item',
        fieldId: 'orderline',
        line: i
      });
      const soLineNum = soRec.findSublistLineWithValue({
        sublistId: 'item',
        fieldId: 'line',
        value: orderLine
      });

      if (soLineNum >= 0) {
        log.audit('soLineNum', soLineNum);
        const closed = soRec.getSublistValue({
          sublistId: 'item',
          fieldId: 'isclosed',
          line: soLineNum
        });
        if (closed) continue;

        const item = soRec.getSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: soLineNum
        });
        const quantityOrdered = soRec.getSublistValue({
          sublistId: 'item',
          fieldId: 'quantity',
          line: soLineNum
        });
        const quantityAvailable = soRec.getSublistValue({
          sublistId: 'item',
          fieldId: 'quantityavailable',
          line: soLineNum
        });

        if (quantityAvailable < quantityOrdered) {
          backorderedLines.push({
            item, orderLine, quantityOrdered, quantityAvailable
          });
        }
      }
    }

    log.audit('backorderedLines', backorderedLines);
    return backorderedLines;
  }

  function createBackorderSO(backorderedLines, soRec, soId) {
    // get so fields
    const customer = soRec.getValue('entity');
    const originalSO = soRec.getValue('custbody_mhi_original_bo_so');

    // create so
    const backorderSORec = record.create({
      type: 'salesorder',
      isDynamic: true,
      defaultValues: {
        entity: customer
      }
    });

    log.audit('originalSO', originalSO);
    if (originalSO) {
      backorderSORec.setValue('custbody_mhi_original_bo_so', originalSO);
    } else {
      backorderSORec.setValue('custbody_mhi_original_bo_so', soId);
    }

    for (let i = 0; i < backorderedLines.length; i += 1) {
      const currentBOLine = backorderedLines[i];
      backorderSORec.selectNewLine({
        sublistId: 'item'
      });
      backorderSORec.setCurrentSublistValue({
        sublistId: 'item',
        fieldId: 'item',
        value: currentBOLine.item
      });
      backorderSORec.setCurrentSublistValue({
        sublistId: 'item',
        fieldId: 'quantity',
        value: currentBOLine.quantityOrdered - currentBOLine.quantityAvailable
      });
      backorderSORec.commitLine({
        sublistId: 'item'
      });
    }

    return backorderSORec.save({ ignoreMandatoryFields: true });
  }

  function closeLinesOriginalSO(backorderedLines, soRec) {
    for (let i = 0; i < backorderedLines.length; i += 1) {
      const currentBOLine = backorderedLines[i];
      const soLineNum = soRec.findSublistLineWithValue({
        sublistId: 'item',
        fieldId: 'line',
        value: currentBOLine.orderLine
      }) || '';

      if (soLineNum >= 0) {
        soRec.setSublistValue({
          sublistId: 'item',
          fieldId: 'isclosed',
          value: true,
          line: soLineNum
        });
      }
    }

    return soRec.save({ ignoreMandatoryFields: true });
  }

  return {
    afterSubmit
  };
});
