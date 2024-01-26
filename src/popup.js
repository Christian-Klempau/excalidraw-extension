const chars =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
// Use a lookup table to find the index.
const lookup = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

/**
 * objectMap(myObject, (v, k) => ...)
 **/
const objectMap = (obj, fn) =>
  Object.fromEntries(Object.entries(obj).map(([k, v], i) => [k, fn(v, k, i)]));

const decode = function (base64) {
  let bufferLength = base64.length * 0.75,
    len = base64.length,
    i,
    p = 0,
    encoded1,
    encoded2,
    encoded3,
    encoded4;
  if (base64[base64.length - 1] === "=") {
    bufferLength--;
    if (base64[base64.length - 2] === "=") {
      bufferLength--;
    }
  }
  const arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);
  for (i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }
  return arraybuffer;
};

function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

const decryptShareLinkData = async (key, value) => {
  const iv = decode(value.slice(0, 16));
  const buffer = decode(value.slice(16));
  const importedKey = await window.crypto.subtle.importKey(
    "jwk",
    {
      alg: "A128GCM",
      ext: true,
      k: key,
      key_ops: ["encrypt", "decrypt"],
      kty: "oct",
    },
    {
      name: "AES-GCM",
      length: 128,
    },
    false, // extractable
    ["decrypt"]
  );
  const result = await window.crypto.subtle
    .decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      importedKey,
      buffer
    )
    .catch(console.error);
  return new TextDecoder().decode(result);
};

const $ = document.querySelector.bind(document);
const GITHUB_ACCOUNT_KEY = ["token", "owner", "repo"];
let githubAccount = {};

/**  
GLOBAL key: sha256, value: fileName
**/
let FILES = {};

const xButton =
  '<svg type="button" width="24" height="24" viewBox="0 0 24 24"><path fill="white" d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"></path></svg>';

function deleteImageFromGitHub(fileName, fileSha) {
  const { token, repo, owner } = githubAccount;
  return fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: "delete from excalidraw extention",
        sha: fileSha,
      }),
    }
  ).then((res) => res.json());
}

function fetchGitHubFiles() {
  const { token, repo, owner } = githubAccount;
  return fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
    {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    }
  )
    .then((res) => res.json())
    .catch(console.error);
}

function renderFiles(files) {
  const createElement = (fileName, fileSha) =>
    `<li class="list-item-container" data-sha=${fileSha}>
    <span data-sha=${fileSha} class="open-file">${fileName.substring(
      0,
      25
    )}</span>
    <span data-sha=${fileSha} class="delete-file">${xButton}</span></li>`;

  // key: sha, value: html element
  const shaToElem = objectMap(files, createElement);
  // convert object to array
  const listStr = Object.values(shaToElem).join("");
  $(".files").innerHTML = listStr;
}

async function openExalidrawFile() {
  await sleep(1000);
  const files = document.getElementsByClassName("open-file");
  for (file of files) {
    file.addEventListener("click", (evt) => {
      const fileSha = evt.target.getAttribute("data-sha");
      const filePath = FILES[fileSha];

      const linkEncryptData = filePath.split(".")[1];
      decryptShareLinkData(
        githubAccount.token.slice(githubAccount.token.length - 22),
        linkEncryptData
      )
        .then((res) => {
          chrome.tabs.create({
            active: true,
            url: "https://excalidraw.com/#json=" + res,
          });
        })
        .catch(console.error);
    });
  }
}

async function deleteExcalidrawFile() {
  await sleep(1000);
  const files = document.getElementsByClassName("delete-file");

  for (file of files) {
    file.addEventListener("click", (evt) => {
      /* We can click any of these 3, but we need to reach span with data-sha
      <span data-sha="...">
        <svg>
          <path></path>
        </svg>
      </span>
      */

      // assume we clicked span
      let htmlElem = evt.target;

      if (htmlElem.tagName == "svg") {
        // svg --> span
        htmlElem = htmlElem.parentElement;
      } else if (htmlElem.tagName == "path") {
        // path --> svg --> span
        htmlElem = htmlElem.parentElement.parentElement;
      }

      const fileSha = htmlElem.getAttribute("data-sha");
      const filePath = FILES[fileSha];
      console.log("DELETING:", filePath, fileSha);
      deleteImageFromGitHub(filePath, fileSha);
    });
  }
}

function gotoOptionPage() {
  // show the button
  const $container = $(".go-to-option");

  $container.style.display = "block";

  $container.querySelector("button").onclick = () => {
    chrome.runtime.openOptionsPage();
  };
}

function main() {
  // get the account info
  chrome.storage.sync.get(GITHUB_ACCOUNT_KEY).then((result) => {
    if (Object.keys(result).length === GITHUB_ACCOUNT_KEY.length) {
      // show the git files list
      githubAccount = result;
      fetchGitHubFiles().then((res) => {
        FILES = res.tree.reduce((acc, cur) => {
          acc[cur.sha] = cur.path;
          return acc;
        }, {});
        renderFiles(FILES);
        // renderFiles(res.tree.filter(i => /^\d{6}/.test(i.path)));
      });
      openExalidrawFile();
      deleteExcalidrawFile();
    } else {
      // show go to options button
      gotoOptionPage();
    }
  });
}

window.onload = main;
