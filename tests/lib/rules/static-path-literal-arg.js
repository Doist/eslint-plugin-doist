/**
 * @fileoverview Enforce only string literals as arguments to our static deployment tool `$static_path`
 * @author Doist Frontend
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const rule = require("../../../lib/rules/static-path-literal-arg"),
  RuleTester = require("eslint").RuleTester;


//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

const ruleTester = new RuleTester();
ruleTester.run("static-path-literal-arg", rule, {
  valid: [{
    code: "$static_path('/static/images/icon.png')",
  }
  ],

  invalid: [
    {
      code: "$static_path('/static/images/' + 'icon.png')",
      errors: ["$static_path arguments[0] needs to be a string literal"]
    },
  ],
});
