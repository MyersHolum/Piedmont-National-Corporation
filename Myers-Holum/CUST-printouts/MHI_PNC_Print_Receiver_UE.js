/**
 *@NApiVersion 2.1
*@NScriptType UserEventScript
*/
define([], () => {
  function beforeLoad(context) {
    const { form } = context;

    form.addButton({
      id: 'custpage_print_label',
      label: 'Print Receiver',
      functionName: 'printLabel'
    });
    form.clientScriptModulePath = 'SuiteScripts/Myers-Holum/Print-Receiver/MHI_PNC_Print_Receiver_CS.js';
    log.debug(':)');
  }

  return {
    beforeLoad
  };
});
