const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let objects = {};
let variables = {};
let selectedObjectName = null;
let animationTime = 0;

const consoleContent = document.getElementById('consoleContent');

function logError(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  consoleContent.appendChild(div);
  consoleContent.scrollTop = consoleContent.scrollHeight;
}

function clearErrors() {
  consoleContent.textContent = '';
}

function preprocessCode(code) {
  const lines = code.split('\n');
  let cleanLines = [];
  for (let line of lines) {
    const noComment = line.split('//')[0].trim();
    if (noComment.length > 0) cleanLines.push(noComment);
  }
  return cleanLines.join(' ');
}

function splitCommands(code) {
  let cmds = [];
  let i = 0;
  while (i < code.length) {
    if (code.startsWith('for', i)) {
      const forStart = code.indexOf('(', i);
      if (forStart === -1) break;
      let parenCount = 1;
      let j = forStart + 1;
      while (j < code.length && parenCount > 0) {
        if (code[j] === '(') parenCount++;
        else if (code[j] === ')') parenCount--;
        j++;
      }
      if (parenCount !== 0) {
        logError('Syntax error: unmatched parentheses in for statement');
        break;
      }
      while (j < code.length && /\s/.test(code[j])) j++;
      if (code[j] !== '{') {
        logError('Syntax error: expected { after for(...)');
        break;
      }
      let braceCount = 1;
      let k = j + 1;
      while (k < code.length && braceCount > 0) {
        if (code[k] === '{') braceCount++;
        else if (code[k] === '}') braceCount--;
        k++;
      }
      if (braceCount !== 0) {
        logError('Syntax error: unmatched braces in for loop');
        break;
      }
      const forCmd = code.slice(i, k);
      cmds.push(forCmd.trim());
      i = k;
    } else {
      const semi = code.indexOf(';', i);
      if (semi === -1) break;
      const cmd = code.slice(i, semi + 1);
      cmds.push(cmd.trim());
      i = semi + 1;
    }
    while (i < code.length && /\s/.test(code[i])) i++;
  }
  return cmds;
}

function parseArgs(str) {
  return str.split(',').map(s => s.trim());
}

function isColliding(a, b) {
  const sizeA = a.size || 50;
  const sizeB = b.size || 50;
  return !(
    a.x + sizeA < b.x ||
    a.x > b.x + sizeB ||
    a.y + sizeA < b.y ||
    a.y > b.y + sizeB
  );
}

function executeCommands(commands) {
  for (let cmd of commands) {
    if (cmd === '') continue;
    try {
      if (cmd.startsWith('for')) {
        const forMatch = cmd.match(/for\s*\(\s*(.+);(.+);(.+)\s*\)\s*{([\s\S]*)}$/);
        if (!forMatch) {
          logError('Invalid for loop syntax: ' + cmd);
          continue;
        }
        const init = forMatch[1].trim();
        const condition = forMatch[2].trim();
        const increment = forMatch[3].trim();
        let block = forMatch[4].trim();
        if (block.endsWith('}')) block = block.slice(0, -1).trim();

        let blockCommands = splitCommands(block);

        eval(init);
        variables[init.split('=')[0].trim()] = eval(init.split('=')[0].trim());

        while (eval(condition)) {
          executeCommands(blockCommands);
          eval(increment);
          const varName = init.split('=')[0].trim();
          variables[varName] = eval(varName);
        }
      } else {
        if (!cmd.endsWith(';')) {
          logError('Command must end with ; : ' + cmd);
          continue;
        }
        const c = cmd.slice(0, -1);
        if (c.startsWith('object.create')) {
          const args = c.match(/\(([^)]+)\)/)[1];
          let [shape, name] = parseArgs(args);
          for (let v in variables) {
            name = name.replace(new RegExp(`\\b${v}\\b`, 'g'), variables[v]);
          }
          objects[name] = { shape, x: 50, y: 50, color: 'black', opacity: 1, size: 50, collidable: true };
        } else if (c.startsWith('object.color')) {
          const args = c.match(/\(([^)]+)\)/)[1];
          let [name, color] = parseArgs(args);
          for (let v in variables) {
            name = name.replace(new RegExp(`\\b${v}\\b`, 'g'), variables[v]);
          }
          if (objects[name]) objects[name].color = color;
        } else if (c.startsWith('object.move')) {
          const args = c.match(/\(([^)]+)\)/)[1];
          let [name, x, y] = parseArgs(args);
          for (let v in variables) {
            name = name.replace(new RegExp(`\\b${v}\\b`, 'g'), variables[v]);
          }
          if (objects[name]) {
            objects[name].x = parseInt(x);
            objects[name].y = parseInt(y);
          }
        } else if (c.startsWith('object.collidable')) {
          const args = c.match(/\(([^)]+)\)/)[1];
          let [name, val] = parseArgs(args);
          for (let v in variables) {
            name = name.replace(new RegExp(`\\b${v}\\b`, 'g'), variables[v]);
          }
          if (objects[name]) objects[name].collidable = (val.toLowerCase() === 'true');
        } else if (c.match(/^\w+\s*=\s*.+$/)) {
          eval(c);
          const varName = c.split('=')[0].trim();
          variables[varName] = eval(varName);
        } else {
          logError('Unknown command: ' + c);
        }
      }
    } catch (e) {
      logError('Error executing command: ' + cmd + ' - ' + e.message);
    }
  }
}

function parseAlpha(code) {
  clearErrors();
  objects = {};
  variables = {};
  selectedObjectName = null;

  const cleanCode = preprocessCode(code);
  const commands = splitCommands(cleanCode);

  executeCommands(commands);
  selectFirstObject();
}

function selectFirstObject() {
  const keys = Object.keys(objects);
  if (keys.length > 0) selectedObjectName = keys[0];
}

window.addEventListener('keydown', (e) => {
  if (!selectedObjectName) return;
  const speed = 5;
  const obj = objects[selectedObjectName];
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W':
      obj.y -= speed;
      break;
    case 'ArrowDown': case 's': case 'S':
      obj.y += speed;
      break;
    case 'ArrowLeft': case 'a': case 'A':
      obj.x -= speed;
      break;
    case 'ArrowRight': case 'd': case 'D':
      obj.x += speed;
      break;
  }
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (let name in objects) {
    const obj = objects[name];
    const size = obj.size || 50;
    if (mx >= obj.x && mx <= obj.x + size && my >= obj.y && my <= obj.y + size) {
      selectedObjectName = name;
      return;
    }
  }
});

function checkCollisions() {
  const names = Object.keys(objects);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const objA = objects[names[i]];
      const objB = objects[names[j]];

      if (!objA.collidable || !objB.collidable) {
        if (objA.color === 'red') objA.color = 'black';
        if (objB.color === 'red') objB.color = 'black';
        continue;
      }

      if (isColliding(objA, objB)) {
        objA.color = 'red';
        objB.color = 'red';
      } else {
        if (objA.color === 'red') objA.color = 'black';
        if (objB.color === 'red') objB.color = 'black';
      }
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let name in objects) {
    const obj = objects[name];
    ctx.fillStyle = obj.color || '#fff';
    ctx.globalAlpha = obj.opacity !== undefined ? obj.opacity : 1;
    const size = obj.size || 50;

    switch(obj.shape) {
      case 'square':
        ctx.fillRect(obj.x, obj.y, size, size);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(obj.x + size/2, obj.y + size/2, size/2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(obj.x + size/2, obj.y);
        ctx.lineTo(obj.x, obj.y + size);
        ctx.lineTo(obj.x + size, obj.y + size);
        ctx.closePath();
        ctx.fill();
        break;
      default:
        ctx.fillRect(obj.x, obj.y, size, size);
    }
  }

  ctx.globalAlpha = 1;
}

function gameLoop() {
  animationTime += 0.05;
  if (selectedObjectName) {
    const obj = objects[selectedObjectName];
    obj.opacity = 0.5 + 0.5 * Math.sin(animationTime);
    obj.size = 40 + 10 * Math.sin(animationTime * 2);
  }
  checkCollisions();
  render();
  requestAnimationFrame(gameLoop);
}

// --- ВАЖЛИВО: ДОДАЄМО ОБРОБНИК ПОДІЇ CHANGE НА input[type=file]
document.getElementById('fileInput').addEventListener('change', () => {
  loadAlpha();
});

function loadAlpha() {
  const fileInput = document.getElementById("fileInput");
  if (!fileInput.files[0]) {
    alert("Please import a .alpha file first.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    parseAlpha(e.target.result);
    gameLoop();
  };
  reader.readAsText(fileInput.files[0]);
}

// Обробка кліку на лейбл, щоб відкрити діалог вибору файлу
document.getElementById('importLabel').addEventListener('click', () => {
  document.getElementById("fileInput").click();
});

// Кнопка "I want to play..." запускає гру, якщо є об'єкти
document.getElementById('playBtn').addEventListener('click', () => {
  if (Object.keys(objects).length === 0) {
    alert("Please load a .alpha project first!");
    return;
  }
  gameLoop();
});
