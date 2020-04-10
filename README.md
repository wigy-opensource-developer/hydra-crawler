# Hydra Crawler

Hydra Crawler scans the Hydra network to get information about the peers in the network.
This is a fork of the [ARK Crawler](https://github.com/deadlock-delegate/crawler/) so make sure
you sponsor them for their hard work.

## Installation

`npm install`

## Usage

- [Hydra mainnet](http://hydra.iop.global/)
  
  `node . hyd-mainnet.json`

- [Hydra devnet](http://dev.hydra.iop.global/)
  
  `node . hyd-devnet.json`

- [ARK mainnet](https://explorer.ark.io/)
  
  `node . ark-mainnet.json`

- [ARK devnet](https://dev.explorer.ark.io/)
  
  `node . ark-devnet.json`

- If you think the seed nodes for the networks has changed since we downloaded them, just run the download script using `curl` on your system to refresh them from github
  
  `./download.sh`

## Credits

- [roks0n](https://github.com/roks0n)
- [dmvt](https://github.com/dmvt)
- [wigy](https://github.com/wigy-opensource-developer/)
- [All Contributors](../../contributors)

## License

- ARK Delegate: [MIT](LICENSE) © roks0n
- Hydra patches: [MIT](LICENSE) © Decentralized Society Foundation, Panama
