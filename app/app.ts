window['eval'] = global.eval = function () {
  throw new Error('window.eval() is disabled for security');
};

import 'reflect-metadata';
import Vue from 'vue';
import URI from 'urijs';

import { createStore } from './store';
import { ObsApiService } from './services/obs-api';
import { IWindowOptions, WindowsService } from './services/windows';
import { AppService } from './services/app';
import { ServicesManager } from './services-manager';
import Utils from './services/utils';
import electron from 'electron';

const { ipcRenderer, remote } = electron;

const slobsVersion = remote.process.env.SLOBS_VERSION;

if (remote.process.env.NODE_ENV === 'production') {
  const bugsplat = require('bugsplat')('slobs', 'slobs-renderer', slobsVersion);
  window.onerror = (messageOrEvent, source, lineno, colno, error) => bugsplat.post(error);
}

electron.crashReporter.start({
  companyName: 'Streamlabs',
  productName: 'Streamlabs OBS',
  submitURL: 'http://slobs.bugsplat.com/post/bp/crash/postBP.php',
  extra: {
    prod: 'slobs-renderer',
    key: slobsVersion
  }
});

require('./app.less');

document.addEventListener('DOMContentLoaded', () => {
  const store = createStore();
  const servicesManager: ServicesManager = ServicesManager.instance;
  const windowsService: WindowsService = WindowsService.instance;
  const obsApiService = ObsApiService.instance;
  const isChild = Utils.isChildWindow();

  if (isChild) {
    ipcRenderer.on('closeWindow', () => windowsService.closeChildWindow());
    servicesManager.listenMessages();
  } else {
    ipcRenderer.on('closeWindow', () => windowsService.closeMainWindow());
    AppService.instance.load();
  }

  window['obs'] = obsApiService.nodeObs;

  const vm = new Vue({
    el: '#app',
    store,
    render: h => {
      const componentName = isChild ?
          windowsService.state.child.componentName :
          windowsService.state.main.componentName;

      return h(windowsService.components[componentName]);
    }
  });

  // Used for replacing the contents of this window with
  // a new top level component
  ipcRenderer.on('window-setContents', (event: Electron.Event, options: IWindowOptions) => {
    windowsService.updateChildWindowOptions(options);

    // This is purely for developer convencience.  Changing the URL
    // to match the current contents, as well as pulling the options
    // from the URL, allows child windows to be refreshed without
    // losing their contents.
    const newOptions: any = Object.assign({ child: isChild }, options);
    const newURL: string = URI(window.location.href).query(newOptions).toString();

    window.history.replaceState({}, '', newURL);
  });
});