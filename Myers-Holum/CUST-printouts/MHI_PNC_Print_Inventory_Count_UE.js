/**
 *@NApiVersion 2.1
*@NScriptType UserEventScript
*/
define([], () => {
  function beforeLoad(context) {
    const { form } = context;

    form.addButton({
      id: 'custpage_print_label',
      label: 'Print Inventory Count',
      functionName: 'printLabel'
    });
    form.clientScriptModulePath = 'SuiteScripts/Myers-Holum/Print-Inventory/MHI_PNC_Print_Inventory_Count_CS.js';
    log.debug(':)');
  }

  return {
    beforeLoad
  };
});
