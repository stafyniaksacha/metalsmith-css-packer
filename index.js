const debug = require('debug')('metalsmith-css-packer')
const Bluebird  = require('bluebird');
const cheerio = require('cheerio');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const csso = require('csso');
const rp = require('request-promise');


module.exports = options => {
  if (typeof options !== 'object' || options === null) {
    options = {};
  }

  let inline = options.inline || false;
  let siteRootPath = options.siteRootPath || '/';
  let outputPath = options.outputPath || 'assets/stylesheets/';
  let cssoEnabled = options.csso || true;
  let cssoOptions = options.cssoOptions || {};
  let defaultMedia = options.defaultMedia || 'screen';
  let removeLocalSrc = options.removeLocalSrc || false;

  return (files, metalsmith, done) => {
    let styles = {};
    let packedStyles = {};
    let remoteStylesPromises = [];
    let packedStylesUsage = {};

    for (let file in files) {
      // parse only builded html files
      if (!file.endsWith('.html')) {
        continue;
      }

      let $ = cheerio.load(files[file].contents.toString());
      let $links = $('link');
      let $styles = $('style');

      let pageStyles = {};
      let pageStylesHash;

      debug(`processing ${$links.length} linked stylesheets in "${file}" file`);

      $links.each((_, element) => {
        let $element = $(element);

        // here if a <style> element has a "src" attribute
        //  -> external style content
        if ($element.attr('href') && $element.attr('rel') === 'stylesheet' && $element.data('packer') !== 'exclude') {
          let href = $element.attr('href');
          let styleHash = crypto.createHash('sha1').update(href).digest("hex");
          let media = defaultMedia;

          if ($element.attr('media') !== undefined) {
            media = $element.attr('media');
          }

          if (styles[media] === undefined) {
            styles[media] = {};
          }

          if (pageStyles[media] === undefined) {
            pageStyles[media] = [];
          }

          // handle remote styles (uniqness: href)
          //  - add remote style to pending styles
          //  - fetch remote style in memory
          //  - insert it in a cache to avoid to re download it
          //  - remove original <style> tag
          if (href.startsWith('//') || href.startsWith('http')) {
            debug(`+ remote stylesheet located at "${href}"`);

            if (styles[media][styleHash] === undefined) {
              debug(`+-->  processing remote style located at "${href}"`);

              if (href.startsWith('//')) {
                href = 'http:' + href
              }

              // allocate style to prevent multiple processing
              styles[media][styleHash] = ''

              // add remote style to pending styles
              remoteStylesPromises.push(rp(href).then(content => {
                styles[media][styleHash] = content;
              }))
            }

            pageStyles[media].push(styleHash);
          }

          // handle local styles (uniqness: href)
          //  - load local style in memory
          //  - insert it in a cache to avoid to re read it from fs
          //  - remove original <style> tag
          else {
            debug(`+ local stylesheet located at "${href}"`);

            if (styles[media][styleHash] === undefined) {
              debug(`+-->  processing local stylesheet located at "${href}"`);

              // TODO: check with generated css with sass / less
              let stylePath = path.join(metalsmith._directory, metalsmith._source, href)

              if (!fs.existsSync(stylePath)) {
                if (files[href.substring(1)] === undefined) {
                  console.warn(`File missing: ${stylePath}`);
                  return;
                }

                styles[media][styleHash] = files[href.substring(1)].contents.toString();

                if (removeLocalSrc) {
                  delete files[href.substring(1)];
                }
              }
              else {
                styles[media][styleHash] = fs.readFileSync(stylePath, "utf8");
              }
            }

            pageStyles[media].push(styleHash);
          }

          $element.remove();
          return;
        }

        else {
          if ($element.data('packer') === 'exclude') {
            $element.removeAttr('data-packer');
            debug(`- skipping excluded stylesheet <link> tag`);
          }
          else {
            debug(`- skipping unknown stylesheet <link> tag in file "${file}"\n${$element.toString()}`);
          }
        }
      });

      debug(`processing ${$styles.length} inline stylesheets in "${file}" file`);

      $styles.each((_, element) => {
        let $element = $(element);
        let media = defaultMedia;

        if ($element.attr('media') !== undefined) {
          media = $element.attr('media');
        }

        if (styles[media] === undefined) {
          styles[media] = {};
        }

        if (pageStyles[media] === undefined) {
          pageStyles[media] = [];
        }

        // -> internal style content (uniqness: content hash + media attribute if any, sha1 might be enougth)
        //   - load tag content in memory
        //   - remove original <style> tag
        if (($element.attr('type') === 'text/css' || $element.attr('type') === undefined) && $element.data('packer') !== 'exclude') {
          let styleIdentifier = $element.html();

          let styleHash = crypto.createHash('sha1').update($element.html()).digest("hex");

          debug(`+ inline stylesheet identified by "${styleHash}"`);

          if (styles[media][styleHash] === undefined) {
            debug(`+-->  processing inline stylesheet identified by "${styleHash}"`);

            styles[media][styleHash] = $element.html();
          }

          pageStyles[media].push(styleHash);

          $element.remove();
          return;
        }
        else {
          if ($element.data('packer') === 'exclude') {
            $element.removeAttr('data-packer');
            debug(`- skipping excluded stylesheet <link> tag`);
          }
          else {
            debug(`- skipping unknown stylesheet <link> tag in file "${file}"\n${$element.toString()}`);
          }
        }
      })

      // - if current page contains styles, create a hash of style names this page needs
      // we will distinguish same grouped style usage with this
      for (let media in pageStyles) {
        if (pageStyles[media].length > 0) {
          pageStylesHash = crypto.createHash('sha1').update(pageStyles[media].join('.')).digest("hex");

          packedStyles[pageStylesHash] = {
            media,
            ressources: pageStyles[media]
          };

          packedStylesUsage[pageStylesHash] = packedStylesUsage[pageStylesHash] || [];
          packedStylesUsage[pageStylesHash].push(file);

          debug(`register usage of packed style "${pageStylesHash}" (media: "${media}") for file "${file}"`);

          // include style reference only when inline mode is disabled
          if (!inline) {
            $('<link>').attr('media', media).attr('rel', 'stylesheet').attr('href', siteRootPath + outputPath + pageStylesHash + '.min.css').appendTo('head');
          }
        }
      }


      files[file].contents = Buffer.from($.html(), 'utf-8');
    }

    if (remoteStylesPromises.length === 0) {
      remoteStylesPromises.push(Bluebird.resolve());
    }

    // we can pack all styles togethers once all pending remotes styles are fetched
    Bluebird.all(remoteStylesPromises)
      .then(() => {
        for(let pageStylesHash in packedStyles) {
          debug(`create packed stylesheet "${pageStylesHash}", used by ${packedStylesUsage[pageStylesHash].length} files`);

          let packedStyle = '';

          for (let i = 0; i < packedStyles[pageStylesHash].ressources.length; i++) {
            packedStyle += styles[packedStyles[pageStylesHash].media][packedStyles[pageStylesHash].ressources[i]] + '\n'
          }

          if (cssoEnabled) {
            packedStyle = csso.minify(packedStyle, cssoOptions).css;
          }

          // include style reference only when inline mode is enabled
          // else, add new packed file to metalsmith file list
          if (!inline) {
            debug(`write packed stylesheet "${pageStylesHash}" in "${outputPath + pageStylesHash + '.min.css'}" file`);

            files[outputPath + pageStylesHash + '.min.css'] = {
              contents: Buffer.from(packedStyle, 'utf-8')
            }
          }
          else {
            for (let file of packedStylesUsage[pageStylesHash]) {
              debug(`include packed stylesheet "${pageStylesHash}" in "${file}" file`);

              let $ = cheerio.load(files[file].contents.toString());

              $('<style>').attr('media', packedStyles[pageStylesHash].media).html(packedStyle).appendTo('head');

              files[file].contents = Buffer.from($.html(), 'utf-8');
            }
          }
        }
      })
      .then(() => done())
      .catch(err => {
        throw new Error(err)
      })
  }
}
