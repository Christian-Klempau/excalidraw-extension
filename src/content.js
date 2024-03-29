//
function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

(function () {
  /*
   * base64-arraybuffer 1.0.2 <https://github.com/niklasvh/base64-arraybuffer>
   * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
   * Released under MIT License
   */

  var chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  var encode = function (arraybuffer) {
    var bytes = new Uint8Array(arraybuffer),
      i,
      len = bytes.length,
      base64 = "";
    for (i = 0; i < len; i += 3) {
      base64 += chars[bytes[i] >> 2];
      base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
      base64 += chars[bytes[i + 2] & 63];
    }
    if (len % 3 === 2) {
      base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (len % 3 === 1) {
      base64 = base64.substring(0, base64.length - 2) + "==";
    }
    return base64;
  };

  const githubAccount = {};

  function uploadTip(res) {
    console.log("upload github tip:", res);
    try {
      const $excalidrawContainer = document.querySelector(
        ".excalidraw-container"
      );
      const fiberKey = Object.keys($excalidrawContainer).find((i) =>
        i.startsWith("__reactFiber")
      );
      const fiberInstance = $excalidrawContainer[fiberKey]?.return;
      fiberInstance.stateNode.setToast({
        message: "upload to github success",
        duration: 5000,
      });
    } catch (e) {
      console.error(e);
    }
  }

  function uploadImageToGitHub(name, content) {
    const { token, repo, owner } = githubAccount;
    return fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${name}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: "upload from excalidraw extention",
          content: content,
        }),
      }
    )
      .then((res) => res.json())
      .then(uploadTip);
  }

  function addPopupOpener() {
    setTimeout(() => {
      const popup = document.createElement("button");
      popup.addEventListener("click", () => {
        console.log("open popup");
        window.open("popup.html");
      });
      popup.innerText = "See All Files";
      popup.id = "openPopupButton";
      popup.style.position = "fixed";
      popup.style.top = "10px";
      popup.style.right = "10px";
      popup.style.zIndex = "9999";

      let canvas = document.getElementById("root");
      canvas.appendChild(popup);
    }, 1000);
  }

  async function addInput() {
    // wait document to load
    await sleep(500);
    // select Hamburger menu
    const hamburgerButton = document.querySelectorAll(
      "[data-testid=main-menu-trigger]"
    )[0];
    console.log("add input", hamburgerButton);

    hamburgerButton.addEventListener("click", async () => {
      // wait for hamburger to load, select "save to ..." button, then add event listener
      await sleep(500);

      const saveToJsonButton = document.querySelectorAll(
        "[data-testid=json-export-button]"
      )[0];
      saveToJsonButton.addEventListener("click", async () => {
        // wait for it to load, select middle card, then add input (fileNameInput)
        await sleep(500);
        let middleCard =
          document.getElementsByClassName("ExportDialog-cards")[0].children[1];
        let fileNameInput = document.createElement("input");
        fileNameInput.id = "fileNameInput";
        fileNameInput.placeholder = "File Name ...";

        fileNameInput.style.padding = "12px 20px";
        fileNameInput.style.margin = "8px 0";
        fileNameInput.style.display = "inline-block";
        fileNameInput.style.border = "1px solid #ccc";
        fileNameInput.style.borderRadius = "4px";
        fileNameInput.style.boxSizing = "border-box";
        middleCard.appendChild(fileNameInput);
      });
    });
  }

  function getInput() {
    fileNameInput = document.getElementById("fileNameInput");
    const fileName = fileNameInput.value ? fileNameInput.value + "-" : "";
    console.log("get input", fileName);
    return fileName;
  }

  function getExcalidrawName(prefix, type) {
    const date = new Date();
    const formatNum = (num) => (num < 10 ? "0" : "") + num;
    const fileName = getInput();
    return `${fileName}${date.getFullYear()}${formatNum(
      date.getMonth() + 1
    )}${formatNum(date.getDate())}.${encodeURIComponent(prefix)}.${type}`;
  }

  async function getPngDataContentFromClipboard() {
    const items = await navigator.clipboard.read();
    for (let item of items) {
      for (let type of item.types) {
        if (type.startsWith("image/")) {
          return item.getType(type).then((blob) => {
            return new Promise((resolve) => {
              const fileReader = new FileReader();
              fileReader.onload = () => {
                const srcData = fileReader.result;
                resolve(srcData);
              };
              fileReader.readAsDataURL(blob);
            });
          });
        }
      }
    }
    return Promise.resolve(null);
  }

  const encryptShareLinkData = async (key, value) => {
    const buffer = new TextEncoder().encode(value);
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
      ["encrypt"]
    );
    const arr = new Uint8Array(12);
    const iv = window.crypto.getRandomValues(arr);
    const result = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      importedKey,
      buffer
    );
    return encode(iv) + encode(result);
  };

  function uploadExcalidrawImageToGitHub() {
    function triggerDomEvent($dom, eventName) {
      $dom.dispatchEvent(new Event(eventName, { bubbles: true }));
    }

    async function copyPngAndUpload(shareLink) {
      const encodeIdAndKey = await encryptShareLinkData(
        githubAccount.token.slice(githubAccount.token.length - 22),
        shareLink
      );

      triggerDomEvent(
        document.querySelector(".excalidraw__canvas"),
        "contextmenu"
      );
      await sleep(10);
      const copyAsPNG = document
        .querySelector(".context-menu")
        .querySelector('[data-testid="copyAsPng"]');
      triggerDomEvent(copyAsPNG, "click");
      await sleep(500);
      // get clipboard data to upload
      const base64Str = await getPngDataContentFromClipboard();
      if (base64Str) {
        uploadImageToGitHub(
          getExcalidrawName(encodeIdAndKey, "png"),
          base64Str.replace("data:image/png;base64,", "")
        );
      } else {
        uploadImageToGitHub(
          getExcalidrawName(encodeIdAndKey, ""),
          btoa("no png data")
        );
      }
    }

    addInput();
    // addPopupOpener();
    // intercept the window.prompt, so we can get the share link
    const originPromt = window.prompt;
    window.prompt = (message, value) => {
      console.log("share link:", value);
      if (value.includes("https://excalidraw.com/#json=")) {
        const { token, repo, owner } = githubAccount;
        if ((token, repo, owner)) {
          copyPngAndUpload(value.split("json=")[1]);
        } else {
          originPromt.apply(window, [
            `${message}, you can go extensions options page to config the github account`,
            value,
          ]);
        }
      } else {
        originPromt.apply(window, [message, value]);
      }
    };
  }
  uploadExcalidrawImageToGitHub();
  console.log("init content success");
  // get github account info
  window.addEventListener("message", (event) => {
    if (event.data.type === "github-account") {
      console.log("get github account:", event.data);
      Object.assign(githubAccount, event.data.payload);
    }
  });
})();
