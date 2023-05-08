import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
} from 'homebridge';

import ping from 'ping';
import wol from 'wol';
import fetch from 'node-fetch';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('Wake-on-LAN', ComputerLanSwitch);
};

class ComputerLanSwitch implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly api: API;

  private readonly _macAddress: string;
  private readonly _hostname: string;

  private readonly switchService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.api = api;

    this._macAddress = config.macAddress as string;
    this._hostname = config.hostname as string;

    log.info('Address: ' + config['ethernetAddress']);
    log.info('MAC Address: ' + config['macAddress']);

    this.switchService = new hap.Service.Switch(this.name);
    this.switchService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getOnHandler.bind(this))
      .on(CharacteristicEventTypes.SET, this.setOnHandler.bind(this));

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Custom Manufacturer')
      .setCharacteristic(hap.Characteristic.Model, 'Custom Model');

    log.info(`Wake-on-LAN for '${this.name}' finished initializing!`);
  }

  getOnHandler(callback: CharacteristicGetCallback) {
    ping.sys.probe(this._hostname, (isAlive, err) => {
      if (err) {
        this.log.error(err);
        callback(err, null);
      } else {
        this.log.debug('Current state of the computer was returned: ' + (isAlive ? 'ON' : 'OFF'));
        callback(null, isAlive);
      }
    });
  }

  setOnHandler(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const newState = value as boolean;

    if (newState) {
      this.turnOnComputer();
    } else {
      this.turnOffComputer();
    }

    this.log.debug('Switch state was set to: ' + (newState ? 'ON' : 'OFF'));
    callback(null);
  }

  turnOnComputer(): void {
    wol.wake(this._macAddress, (err, res) => {
      if (err) {
        this.log.error(err.message);
      } else {
        this.log.debug(`Wake on LAN request sent. ${res}`);
      }
    });
  }

  async turnOffComputer(): Promise<void> {
    try {
      const response = await fetch('http://${this._hostname}:7763/poweroff');
      
      if (!response.ok) {
        this.log.debug(`Error: ${response.statusText}`);
      }
    } catch (error) {
      this.log.debug('Error!');
    }
  }
  

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }
}