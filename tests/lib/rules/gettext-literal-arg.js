/**
 * @fileoverview Enforce only string literals as arguments to our i18n helper `_()`
 * @author Doist Frontend
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const rule = require("../../../lib/rules/gettext-literal-arg"),
  RuleTester = require("eslint").RuleTester;


//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

const ruleTester = new RuleTester();
ruleTester.run("gettext-literal-arg", rule, {
  valid: [
    "_('lorem ipsum')"
  ],

  invalid: [
    {
      code: "_('lorem' + 'ipsum')",
      errors: ["_ arguments[0] needs to be a string literal"]
    },
  ],
});
