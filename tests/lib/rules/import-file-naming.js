/**
 * @fileoverview Enforce naming conventions when importing given file types
 * @author Doist Frontend
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const rule = require("../../../lib/rules/import-file-naming"),
  RuleTester = require("eslint").RuleTester;


//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: "module" }
});
ruleTester.run("import-file-naming", rule, {
  valid: [
    {
        code: "import myPicture from './video-signup-quote-poster.png'",
        options: [{ camelcase: ["png"] }]
    },
    {
        code: "import MyJPG from './video-signup-quote-poster.jpg'",
        options: [{ pascalcase: ["png", "mp4", "jpg"] }]
    }
],

invalid: [
  {
      code: "import VideoSignupQuotePoster from './video-signup-quote-poster.png'",
      options: [{ camelcase: ["png"] }],
      errors: ["Use camelcase when importing png files."]
  },
  {
      code: "import MyVideo from './video-signup-quote-poster.MP4'",
      options: [{ camelcase: ["png", "mp4"] }],
      errors: ["Use camelcase when importing png or mp4 files."]
  }
]
});
