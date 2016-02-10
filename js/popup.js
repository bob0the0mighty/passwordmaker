var parseUrl = require('url').parse;
var makePassword = require('passwordmaker');
var debounce = require('debounce');

var inputs = {
	domain: document.getElementById('domain'),
	masterPassword: document.getElementById('master-password'),
	generatedPassword: document.getElementById('generated-password')
};

var buttons = {
	copy: document.getElementById('btn-copy'),
	autoFill: document.getElementById('btn-auto-fill'),
	saveMasterPassword: document.getElementById('btn-save-master'),
	options: document.getElementById('btn-options')
};

var prefs = null;

var optionsStorage = chrome.storage.sync || chrome.storage.local;
var masterPasswordStorage = chrome.storage.local;

function loadOptions(done) {
	optionsStorage.get(defaultOptions, function (items) {
		prefs = items;
    done();
	});
}

function initUi() {
	var generatePasswordDebounced = debounce(generatePassword, 500);

  var isGeneratedPasswdRevealed = function () {
  	return (inputs.generatedPassword.type == 'text');
  };
  var revealGeneratedPasswd = function () {
  	inputs.generatedPassword.type = 'text';
  	inputs.generatedPassword.select();
  };
  var hideGeneratedPasswd = function () {
  	inputs.generatedPassword.type = 'password';
  };

  // Listen for keyup events
  inputs.domain.addEventListener('keyup', function () {
  	generatePasswordDebounced();
  });
  inputs.masterPassword.addEventListener('keyup', function () {
    buttons.saveMasterPassword.disabled = false;
  	generatePasswordDebounced();
  });

  inputs.generatedPassword.addEventListener('mouseover', function () {
  	if (prefs && prefs.passwordVisibility == 'hover') {
  		revealGeneratedPasswd();
  	}
  });
  inputs.generatedPassword.addEventListener('mouseout', function () {
  	if (prefs && prefs.passwordVisibility == 'hover') {
  		hideGeneratedPasswd();
  	}
  });
  inputs.generatedPassword.addEventListener('focus', function () {
  	if (!inputs.generatedPassword.value.length) {
  		generatePassword();
  	}
  	if (prefs && prefs.passwordVisibility == 'click') {
  		revealGeneratedPasswd();
  	}
  });
  inputs.generatedPassword.addEventListener('blur', function () {
  	if (prefs && prefs.passwordVisibility == 'click') {
  		hideGeneratedPasswd();
  	}
  });
  inputs.generatedPassword.addEventListener('click', function () {
  	if (prefs && prefs.passwordVisibility == 'click' && !isGeneratedPasswdRevealed()) {
  		revealGeneratedPasswd();
  	}
  });

  // Listen for clicks on buttons
  buttons.copy.addEventListener('click', function () {
    inputs.generatedPassword.select();

    var success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {}

    if (success) {
      window.close();
    }
  });

  buttons.saveMasterPassword.addEventListener('click', function () {
    masterPasswordStorage.set({
      masterPassword: inputs.masterPassword.value
    });

    buttons.saveMasterPassword.disabled = true;
  });

  // Auto-fill password
  function autoFillPassword() {
    var password = inputs.generatedPassword.value;

    if (password.length !== 0) {
      password = password.replace(/"/g, '\\"');
      chrome.tabs.executeScript({
        code: 'if (document.activeElement) { document.activeElement.value = "'+password+'"; }'
      });

      window.close();
  	}
  }
  document.addEventListener('keypress', function (event) {
  	if (event.keyCode == 13) { // Enter key
  		event.preventDefault();
  		autoFillPassword();
  	}
  });
  buttons.autoFill.addEventListener('click', function () {
    autoFillPassword();
  });

	buttons.options.addEventListener('click', function (event) {
		if (chrome.runtime.openOptionsPage) {
			chrome.runtime.openOptionsPage();
		} else {
			window.open(chrome.runtime.getURL('options.html'));
		}
	});

  masterPasswordStorage.get({
    masterPassword: ''
  }, function (items) {
    if (items.masterPassword) {
      inputs.masterPassword.value = items.masterPassword;
      buttons.saveMasterPassword.disabled = true;
    }
  });

  loadOptions(function () {
    if (prefs.passwordVisibility == 'always') {
  		revealGeneratedPasswd();
  	} else {
  		hideGeneratedPasswd();
  	}

    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.url) return;

  		var host = parseUrl(tab.url).hostname;
      if (prefs.urlComponents == 'domain') {
        host = host.split('.').slice(-2).join('.');
      }
      inputs.domain.value = host;

      if (!inputs.masterPassword.value) {
    		if (!inputs.domain.value) {
    			inputs.domain.focus();
    		} else {
    			inputs.masterPassword.focus();
    		}
    	} else {
    		generatePassword();
    		inputs.generatedPassword.focus();
    	}
  	});
  });
}

function generatePassword() {
  var charset = charsets[prefs.charset];
  if (prefs.charset == 'custom') {
    charset = prefs.customCharset;
  }

  var opts = {
		data: inputs.domain.value,
		masterPassword: inputs.masterPassword.value,
		modifier: prefs.modifier,
		hashAlgorithm: prefs.hashAlgorithm,
		whereToUseL33t: prefs.useL33t,
		l33tLevel: prefs.l33tLevel,
		length: prefs.length,
		prefix: prefs.prefix,
		suffix: prefs.suffix,
		charset: charset
	};

  if (!opts.masterPassword) {
    return;
  }

	var password = '';
	try {
		password = makePassword(opts)
	} catch (err) {
		console.error(err);
	}

	inputs.generatedPassword.value = password;
}

initUi();
