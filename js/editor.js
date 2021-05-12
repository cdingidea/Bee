(() => {

  const VERSION = '1.0.0';
  const CLEAR = console.clear;
  const LOG = console.log;
  const tabHeaders = [...document.querySelectorAll('.editor__tab-headers')];
  const tabContents = [...document.querySelectorAll('.editor__tab-contents')];
  const FRAME_TIME = 1000 / 50;
  let ASSETS = {};
  let keyDown = {};
  let keyUp = {};
  const mouse = {
    x: 0,
    y: 0,
    pressed: false,
    released: false,
  };
  const key = {
    pressed: (keyCode) => keyDown[keyCode],
    released: (keyCode) => keyUp[keyCode],
  };

  let activeTab = null;
  let animationID = null;
  let resultProcess = null;
  let frameTime = FRAME_TIME;
  let lastTime = 0;
  let accumulatedTime = 0;
  let offsetTime = 0;

  function initEditor(editorElement) {
    return ace.edit(editorElement, {
      mode: 'ace/mode/javascript',
      theme: 'ace/theme/monokai',
      showPrintMargin: false,
      tabSize: 2,
    });
  }

  tabHeaders.forEach((headers, index) => {
    const childrenCount = headers.children.length;
    for (let i=0; i<childrenCount; i++) {
      headers.children[i].addEventListener('click', () => {
        for (let j=0; j<childrenCount; j++) {
          headers.children[j].classList.remove('active');
          tabContents[index].children[j].classList.remove('active');
        }
        headers.children[i].classList.add('active');
        tabContents[index].children[i].classList.add('active');
        activeTab = tabContents[index].children[i];
        focusEditor();
      });
    }
  });

  const startButton = document.getElementById('start-button');
  const stopButton = document.getElementById('stop-button');
  const newButton = document.getElementById('new-button');
  const saveButton = document.getElementById('save-button');
  const exportButton = document.getElementById('export-button');
  const startFn = document.getElementById('start-fn');
  const updateFn = document.getElementById('update-fn');
  const drawFn = document.getElementById('draw-fn');
  const startEditor = initEditor(startFn);
  const updateEditor = initEditor(updateFn);
  const drawEditor = initEditor(drawFn);
  const footerOne = document.getElementById('footer-one');
  const footerThree = document.getElementById('footer-three');
  const fileDialogElement = document.getElementById('file-dialog');
  const assetsElement = document.getElementById('assets');
  const addImageAssetInput = document.getElementById('asset-add-image');
  const addSoundAssetInput = document.getElementById('asset-add-sound');
  const consoleElement = document.getElementById('editor-console');
  const canvasElement = document.querySelector('canvas');
  const canvasContext = canvasElement.getContext('2d');
  const project = () => new Function('PI', 'PI2', 'width', 'height', 'context', 'setSize', 'image', 'sound',
  `
    // start
    ${startEditor.getValue()}

    // update
    function update(deltaTime, width, height, mouse, key) {
      ${updateEditor.getValue()}
    }

    // draw
    function draw(width, height) {
      ${drawEditor.getValue()}
    }

    return { update, draw };
  `)(
    Math.PI, Math.PI * 2,
    canvasElement.width, canvasElement.height, canvasContext,
    function () {}, getImageAsset, getSoundAsset);

  function getHTMLFromObject(value, tab=0) {
    let html = '';
    switch (typeof(value)) {
      case 'function':
        html += `<span style="color:#66D9EF">function</span> ${value.name}`;
        break;

      case 'boolean':
      case 'number':
        html += `<span style="color:#AE81FF">${value}</span>`;
        break;

      case 'string':
        html += `<span style="color:#E6DB74">"${value}"</span>`;
        break;
      
      case 'object':
        if (Array.isArray(value)) {
          html += `<span style="color:gray">(${value.length})</span> [\n`;
          for (let item of value) {
            html += ' '.repeat(tab + 2) + getHTMLFromObject(item, tab + 2) + ',\n';
          }
          html += ' '.repeat(tab) + ']';
        } else {
          html += `{\n`;
          for (let prop in value) {
            html += ' '.repeat(tab + 2) + `${prop}: ` + getHTMLFromObject(value[prop], tab + 2) + ',\n';
          }
          html += ' '.repeat(tab) + '}';
        }
        break;

      default:
        html += String(value);
        break;
    }
    return html;
  }

  console.log = (...args) => {
    consoleElement.innerHTML += args.map(item => `<p>${getHTMLFromObject(item)}</p>`).join('');
    LOG(...args);
  };

  console.clear = () => {
    consoleElement.innerHTML = '';
    CLEAR();
  };
  
  function focusEditor() {
    switch (activeTab.id) {
      case 'start-fn':
        startEditor.focus();
        break;
      case 'update-fn':
        updateEditor.focus();
        break;
      case 'draw-fn':
        drawEditor.focus();
        break;
    }
  }

  function printError(e) {
    footerOne.innerHTML = `<span class="error">Error</span>`;
    consoleElement.innerHTML += `<p style="background-color:rgba(255, 99, 71, 0.1)"><span style="color:tomato">${e.name}</span>: ${e.message}</p>`;
  }

  function resize() {
    canvasElement.width = canvasElement.clientWidth;
    canvasElement.height = canvasElement.clientHeight;
    consoleElement.style.height = consoleElement.clientHeight + 'px';
    assetsElement.style.height = consoleElement.clientHeight + 'px';
  }

  function cycle() {
    let currentTime = performance.now();
    let elapsedTime = currentTime - lastTime;
    lastTime = currentTime;
    accumulatedTime += elapsedTime;

    while (accumulatedTime >= frameTime) {
      try {
        if (resultProcess) {
          resultProcess.update(
            frameTime / 1000,
            canvasElement.width,
            canvasElement.height,
            mouse,
            key,
          );
        }
      } catch (e) {
        printError(e);
      } 
      accumulatedTime -= frameTime;
    }
    
    try {
      if (resultProcess) {
        resultProcess.draw(
          canvasElement.width,
          canvasElement.height,
        );
      }
    } catch (e) {
      printError(e);
    }

    if (offsetTime > 10) {
      offsetTime = 0;
      footerThree.innerHTML = `<span>FPS: <b>${Math.round(1000 / elapsedTime)}</b></span><span>DeltaTime: <b>${(frameTime / 1000).toFixed(3)}</b></span>`;
    } else {
      offsetTime += 1;
    }

    keyUp = {};
    mouse.released = false;
    animationID = requestAnimationFrame(cycle);
  }

  function start() {
    if (!animationID) {
      startEditor.setReadOnly(true);
      updateEditor.setReadOnly(true);
      drawEditor.setReadOnly(true);
      stopButton.classList.remove('disabled');
      startButton.classList.add('disabled');
      console.clear();

      canvasElement.focus();
      try {
        resultProcess = project();
      } catch (e) {
        printError(e);
      }
      lastTime = performance.now();
      if (updateEditor.getValue() != '' || drawEditor.getValue() != '') {
        animationID = requestAnimationFrame(cycle);
      } else {
        stop(true);
      }
    }
  }

  function stop(force=false) {
    if (animationID || force) {
      startEditor.setReadOnly(false);
      updateEditor.setReadOnly(false);
      drawEditor.setReadOnly(false);
      stopButton.classList.add('disabled');
      startButton.classList.remove('disabled');

      cancelAnimationFrame(animationID);
      animationID = null;
      resultProcess = null;
      frameTime = FRAME_TIME;
      lastTime = 0;
      accumulatedTime = 0;
      offsetTime = 0;
      footerOne.innerHTML = '';
      footerThree.innerHTML = '';
      canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
    focusEditor();
  }

function saveFile(name, extension, content) {
  const blob = new Blob([content], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name + extension;
  anchor.click();
}

function loadData() {
  if (localStorage.getItem('__BeeEngine__Data__')) {
    const data = JSON.parse(localStorage.getItem('__BeeEngine__Data__'));
    startEditor.setValue(data.start);
    updateEditor.setValue(data.update);
    drawEditor.setValue(data.draw);
    
    for (let assetName in data.assets) {
      switch (data.assets[assetName].type) {
        case 'image':
          let image = new Image();
          image.src = data.assets[assetName].url;
          addImageAssetElement(data.assets[assetName], assetName, image);
          ASSETS[assetName] = data.assets[assetName];
          break;

        case 'sound':
          let sound = new Audio();
          sound.src = data.assets[assetName].url;
          addSoundAssetElement(data.assets[assetName], assetName, sound);
          ASSETS[assetName] = data.assets[assetName];
          break;
      }
    }
  }

  saveData();
}

function saveData() {
  const data = {
    start: startEditor.getValue(),
    update: updateEditor.getValue(),
    draw: drawEditor.getValue(),
    assets: ASSETS,
  };
  localStorage.setItem('__BeeEngine__Data__', JSON.stringify(data));
}

fileDialogElement.addEventListener('change', () => {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    let jsonData = JSON.parse(reader.result);
    startEditor.setValue(jsonData.start);
    updateEditor.setValue(jsonData.update);
    drawEditor.setValue(jsonData.draw);
    startEditor.clearSelection();
    updateEditor.clearSelection();
    drawEditor.clearSelection();

    for (let assetName in jsonData.assets) {
      switch (jsonData.assets[assetName].type) {
        case 'image':
          let image = new Image();
          image.src = jsonData.assets[assetName].url;
          addImageAssetElement(jsonData.assets[assetName], assetName, image);
          ASSETS[assetName] = jsonData.assets[assetName];
          break;

        case 'sound':
          let sound = new Audio();
          sound.src = jsonData.assets[assetName].url;
          addSoundAssetElement(jsonData.assets[assetName], assetName, sound);
          ASSETS[assetName] = jsonData.assets[assetName];
          break;
      }
    }

    saveData();
  });
  reader.readAsText(fileDialogElement.files[0]);
});

newButton.addEventListener('click', () => {
  if (confirm('Are you sure you want to clean?')) {
    stopButton.click();
    startEditor.setValue('');
    updateEditor.setValue('');
    drawEditor.setValue('');
    startEditor.clearSelection();
    updateEditor.clearSelection();
    drawEditor.clearSelection();
    ASSETS = {};
    assetsElement.innerHTML = '';    
    saveData();
  }
});

saveButton.addEventListener('click', () => {
  const jsonData = {
    start: startEditor.getValue(),
    update: updateEditor.getValue(),
    draw: drawEditor.getValue(),
    assets: ASSETS,
  };
  saveFile('my-project', '.json', JSON.stringify(jsonData));
});

function getAssetSize() {
  let result = 0;
  for (let name in ASSETS) {
    result += 1;
  }
  return result;
}

function getImageAssetsString() {
  let result = 'const images = {';
  for (let assetName in ASSETS) {
    const asset = ASSETS[assetName];
    if (asset.type == 'image') {
      result += '\n' + ' '.repeat(6) + `'${assetName}': '${asset.url}',`;
    }
  }
  result += '\n' + ' '.repeat(4) + '};\n\n';
  result += ' '.repeat(4) + `for (let imageName in images) {\n`;
  result += ' '.repeat(6) + `const url = images[imageName];\n`;
  result += ' '.repeat(6) + `images[imageName] = new Image();\n`;
  result += ' '.repeat(6) + `images[imageName].addEventListener('load', loadedAsset);\n`;
  result += ' '.repeat(6) + `images[imageName].src = url;\n`;
  result += ' '.repeat(4) + `}`;
  return result;
}

function getSoundAssetsString() {
  let result = 'const sounds = {';
  for (let assetName in ASSETS) {
    const asset = ASSETS[assetName];
    if (asset.type == 'sound') {
      result += '\n' + ' '.repeat(6) + `'${assetName}': '${asset.url}',`;
    }
  }
  result += '\n' + ' '.repeat(4) + '};\n\n';
  result += ' '.repeat(4) + `for (let soundName in sounds) {\n`;
  result += ' '.repeat(6) + `const url = sounds[soundName];\n`;
  result += ' '.repeat(6) + `sounds[soundName] = new Audio();\n`;
  result += ' '.repeat(6) + `sounds[soundName].src = url;\n`;
  result += ' '.repeat(6) + `sounds[soundName].addEventListener('loadeddata', loadedAsset);\n`;
  result += ' '.repeat(4) + `}`;
  return result;
}

function getImageAsset(name) {
  for (let assetName in ASSETS) {
    if (ASSETS[assetName].type =='image' &&  assetName == name) {
      return ASSETS[assetName].obj;
    }
  }
  throw `Image not found: ${name}`;
}

function getSoundAsset(name) {
  for (let assetName in ASSETS) {
    if (ASSETS[assetName].type =='sound' &&  assetName == name) {
      return ASSETS[assetName].obj;
    }
  }
  throw `Sound not found: ${name}`;
}

exportButton.addEventListener('click', () => {
  const name = prompt('Project Name', 'sketch');
  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>* {margin: 0;padding: 0;border: 0;}body {overflow: hidden;background-color:#212223}canvas{display: block;}canvas.scene{margin:42px auto;border:1px solid #2c2d2e;}</style>
</head>
<body>
  <canvas></canvas>
  <script>

    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    const PI = Math.PI;
    const PI2 = 2 * PI;
    
    let keyDown = {};
    let keyUp = {};
    let width = canvas.width = innerWidth;
    let height = canvas.height = innerHeight;
    let frameTime = ${frameTime} /* 1000/50 */
    let lastTime = performance.now();
    let accumulatedTime = 0;
    let canvasSized = false;
    let loadedAssetSize = 0;
    let totalAssetSize = ${getAssetSize()};

    const mouse = {
      x: 0,
      y: 0,
      pressed: false,
      released: false,
    };

    const key = {
      pressed: (keyCode) => keyDown[keyCode],
      released: (keyCode) => keyUp[keyCode],
    };

    ${getImageAssetsString()}
    
    ${getSoundAssetsString()}

    function resize() {
      width = canvas.width = innerWidth;
      height = canvas.height = innerHeight;
    }

    function setSize(w, h) {
      canvas.width = w;
      canvas.height = h;
      width = w;
      height = h;
      canvasSized = true;
      canvas.className = 'scene';
    }

    function loadedAsset() {
      loadedAssetSize += 1;
      if (loadedAssetSize == totalAssetSize) {
        init();
      }
    }

    function sound(name) {
      return sounds[name];
    }

    function image(name) {
      return images[name];
    }

    function init() {
      ${startEditor.getValue().replace(/\n/g, '\n      ')}
    
      function update(deltaTime) {
        ${updateEditor.getValue().replace(/\n/g, '\n        ')}
      }
  
      function draw() {
        ${drawEditor.getValue().replace(/\n/g, '\n        ')}
      }
  
      function render() {
        let currentTime = performance.now();
        let elapsedTime = currentTime - lastTime;
        lastTime = currentTime;
        accumulatedTime += elapsedTime;
  
        while (accumulatedTime >= frameTime) {
          update(frameTime / 1000);
          accumulatedTime -= frameTime;
        }
  
        draw();
        keyUp = {};
        mouse.released = false;
        requestAnimationFrame(render);
      }

      requestAnimationFrame(render);
      if (!canvasSized) {
        addEventListener('resize', resize);
        resize();
      }
    }

    window.addEventListener('keydown', (e) => {
      keyDown[e.keyCode] = true;
    });
    window.addEventListener('keyup', (e) => {
      keyDown[e.keyCode] = false;
      keyUp[e.keyCode] = true;
    });
    canvas.addEventListener('mousedown', (e) => {
      mouse.pressed = true;
    });
    canvas.addEventListener('mouseup', (e) => {
      mouse.pressed = false;
      mouse.released = true;
    });
    canvas.addEventListener('mousemove', (e) => {
      const bounds = canvas.getBoundingClientRect();
      mouse.x = e.clientX - bounds.left;
      mouse.y = e.clientY - bounds.top;
    });
  </script>
</body>
</html>`;
  saveFile(name, '.html', code);
});

function addImageAssetElement(data, assetName, obj) {
  const _assetNode = document.createElement('div');
  const _imageNode = document.createElement('div');
  const _infoNode = document.createElement('div');
  const _imgNode = document.createElement('img');
  const _nameNode = document.createElement('span');
  const _typeNode = document.createElement('span');
  const _sizeNode = document.createElement('span');
  const _removeNode = document.createElement('button');
  
  _assetNode.className = 'asset';
  _imageNode.className = 'image';
  _infoNode.className = 'info';
  _nameNode.className = 'name';
  _typeNode.className = 'type';
  _sizeNode.className = 'size';
  _removeNode.textContent = 'Remove';
  _imgNode.src = data.url;
  _nameNode.textContent = assetName;
  _typeNode.textContent = 'Image';
  obj.addEventListener('load', () => {
    data.obj = obj;
    _sizeNode.textContent = `${obj.width} x ${obj.height}`;
  });
  obj.src = data.url;
  _removeNode.addEventListener('click', () => {
    delete ASSETS[assetName];
    assetsElement.removeChild(_assetNode);
  });

  _imageNode.appendChild(_imgNode);
  _infoNode.appendChild(_nameNode);
  _infoNode.appendChild(_typeNode);
  _assetNode.appendChild(_imageNode);
  _assetNode.appendChild(_infoNode);
  _assetNode.appendChild(_sizeNode);
  _assetNode.appendChild(_removeNode);
  assetsElement.appendChild(_assetNode);
}

function addSoundAssetElement(data, assetName, obj) {
  const _assetNode = document.createElement('div');
  const _imageNode = document.createElement('div');
  const _infoNode = document.createElement('div');
  const _imgNode = document.createElement('img');
  const _nameNode = document.createElement('span');
  const _typeNode = document.createElement('span');
  const _timeNode = document.createElement('span');
  const _playPauseNode = document.createElement('button');
  const _removeNode = document.createElement('button');
  
  _assetNode.className = 'asset';
  _imageNode.className = 'image';
  _infoNode.className = 'info';
  _nameNode.className = 'name';
  _typeNode.className = 'type';
  _timeNode.className = 'time';
  _playPauseNode.textContent = 'Play';
  _removeNode.textContent = 'Remove';
  _imgNode.src = './images/wave.png';
  _nameNode.textContent = assetName;
  _typeNode.textContent = 'Sound';
  obj.src = data.url;
  obj.addEventListener('loadeddata', () => {
    _timeNode.textContent = obj.duration.toFixed(2) + 's';
    data.obj = obj;
  });
  obj.addEventListener('pause', () => _playPauseNode.textContent = 'Play');
  _playPauseNode.addEventListener('click', () => {
    obj.play();
    _playPauseNode.textContent = 'Stop';
  });
  _removeNode.addEventListener('click', () => {
    delete ASSETS[assetName];
    assetsElement.removeChild(_assetNode);
  });

  _imageNode.appendChild(_imgNode);
  _infoNode.appendChild(_nameNode);
  _infoNode.appendChild(_typeNode);
  _infoNode.appendChild(_timeNode);
  _assetNode.appendChild(_imageNode);
  _assetNode.appendChild(_infoNode);
  _assetNode.appendChild(_playPauseNode);
  _assetNode.appendChild(_removeNode);
  assetsElement.appendChild(_assetNode);
}

addImageAssetInput.addEventListener('change', () => {
  const assetName = prompt('Image asset name');
  const data = {
    url: '',
    type: 'image',
  };
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    data.url = reader.result;
    data.obj = new Image();
    addImageAssetElement(data, assetName, data.obj);
    ASSETS[assetName] = data;
    saveData();
  });
  reader.readAsDataURL(addImageAssetInput.files[0]);
});


addSoundAssetInput.addEventListener('change', () => {
  const assetName = prompt('Sound asset name');
  const data = {
    url: '',
    type: 'sound',
  };
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    data.url = reader.result;
    data.obj = new Audio(data.url);
    addSoundAssetElement(data, assetName, data.obj);
    ASSETS[assetName] = data;
    saveData();
  });
  reader.readAsDataURL(addSoundAssetInput.files[0]);
});


document.getElementById('info-button').addEventListener('click', () => {
  alert(`Bee v${VERSION}`);
});

canvasElement.addEventListener('keydown', (e) => {
  keyDown[e.keyCode] = true;
});
canvasElement.addEventListener('keyup', (e) => {
  keyDown[e.keyCode] = false;
  keyUp[e.keyCode] = true;
});
canvasElement.addEventListener('mousedown', (e) => {
  mouse.pressed = true;
});
canvasElement.addEventListener('mouseup', (e) => {
  mouse.pressed = false;
  mouse.released = true;
});
canvasElement.addEventListener('mousemove', (e) => {
  const bounds = canvasElement.getBoundingClientRect();
  mouse.x = e.clientX - bounds.left;
  mouse.y = e.clientY - bounds.top;
});

activeTab = startFn;
startEditor.on('change', saveData);
updateEditor.on('change', saveData);
drawEditor.on('change', saveData);
startButton.addEventListener('click', start);
stopButton.addEventListener('click', stop);
window.addEventListener('resize', resize);
loadData();
startEditor.clearSelection();
updateEditor.clearSelection();
drawEditor.clearSelection();
resize();
focusEditor();

})();