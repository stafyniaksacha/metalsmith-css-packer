# metalsmith-css-packer
> CSS packer/minifier/optimizer for metalsmith"

This plugin is a CSS optimizer: it will pass on generated HTML, look for styles/links tags (external, internal, inline) and bundle all stylesheets in one place.

You can chose to pack your stylesheets in one file, as this, packed stylesheets can be reused through multiple pages. Or you can directly insert packed stylesheets as inline style tag.

*If this plugin doesn't fit your needs, please don't hesitate to ask for feature requests.*

## Installation
```bash
npm install --save metalsmith-css-packer
```

## Usage

### Javascript API

The example bellow show the minimum code needed to pack your files.

```javascript
const metalsmith = require('metalsmith');
const cssPacker = require('metalsmith-css-packer');

metalsmith(__dirname)
  .source('./src')
  .use(cssPacker())
  .build();
```

### Examples

Here is an example with generated HTML output file

#### HTML Input

```html
<html>
  <head>
    <title>My awesome page !</title>

    <link rel="stylesheets" href="//cdn.example.com/bootstrap.css" />
    <link rel="stylesheets" href="//cdn.example.com/font-awesome.css" />
    <link rel="stylesheets" href="/assets/stylesheets/screen.scss" />
    <link rel="stylesheets" media="<custom media rules>" href="/assets/stylesheets/print.scss" />
  </head>
  <body>

    <!-- let's imagine we have an awesome website here -->

    <style>
      body {
        // make the Internet great again
        background: pink;
      }
    </style>
  </body>
</html>
```

#### HTML Output

```html
<html>
  <head>
    <title>My awesome page !</title>
    <link rel="stylesheets" media="screen" href="/assets/stylesheets/e6791aa54bf763f10700a88b38d578282663be53.min.css" />
    <link rel="stylesheets" media="<custom media rules>" href="/assets/stylesheets/0cex1a4bquf764r4ge1relmb3v2ba3s8o6k3wetj.min.css" />
  </head>
  <body>

    <!-- let's imagine we have an awesome website here -->

  </body>
</html>
```
> Here we can see, all script tags are packed/optimized in one file per media

### Exclude element from packing

To blacklist element from packing, simply add `data-packer="exclude"` attribute to elements you want to exclude

#### HTML Input

```html
<html>
  <head>
    <title>My awesome page !</title>

    <link rel="stylesheets" href="//cdn.example.com/bootstrap.css" />
    <link rel="stylesheets" href="//cdn.example.com/font-awesome.css" data-packer="exclude" />
    <link rel="stylesheets" href="/assets/stylesheets/screen.scss" />
    <link rel="stylesheets" media="<custom media rules>" href="/assets/stylesheets/print.scss" />
  </head>
  <body>

    <!-- let's imagine we have an awesome website here -->

    <style>
      body {
        // make the Internet great again
        background: pink;
      }
    </style>
  </body>
</html>
```

#### HTML Output

```html
<html>
  <head>
    <title>My awesome page !</title>
    <link rel="stylesheets" href="//cdn.example.com/font-awesome.css" />
    <link rel="stylesheets" media="screen" href="/assets/stylesheets/e6791aa54bf763f10700a88b38d578282663be53.min.css" />
    <link rel="stylesheets" media="<custom media rules>" href="/assets/stylesheets/0cex1a4bquf764r4ge1relmb3v2ba3s8o6k3wetj.min.css" />
  </head>
  <body>

    <!-- let's imagine we have an awesome website here -->

  </body>
</html>
```

## Options reference
| name   |  default  |  description  |
| --- | --- | --- |
| `inline` | `false` | if `true`, write packed content in a inline style tag instead of a local linked stylesheets |
| `siteRootPath` | `/` | Use if your site root path is not `/` |
| `ouputPath` | `assets/stylesheets/` | Customize output location of packed stylesheets |
| `csso` | `true` | Enable/disable css optimizer |
| `cssoOptions` | `{}` | Options passed to [csso](https://www.npmjs.com/package/csso#minifysource-options) |

> hint: metalsmith-css-packer use debug
