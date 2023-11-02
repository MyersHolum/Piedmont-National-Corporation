/**
 *@NApiVersion 2.1
*@NScriptType UserEventScript
*/
define([], () => {
  function beforeLoad(context) {
    const { form } = context;

    form.addButton({
      id: 'custpage_print_label',
      label: 'Print Labels',
      functionName: 'printLabel'
    });
    form.clientScriptModulePath = 'SuiteScripts/Myers-Holum/Print-Labels/MHI_PNC_Print_Label_CS.js';
    log.debug(':)');
  }

  return {
    beforeLoad
  };
});
