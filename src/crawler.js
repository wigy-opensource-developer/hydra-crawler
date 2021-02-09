const { map, sample } = require('lodash')
const Connections = require('./peer')
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest

const GET_PEERS_FAILED = -2
const CONNECTION_FAILED = -1
const NOT_VISITED = 0
const GET_PEERS_SUCCESS = 1
let NETWORK_P2P_PORT = null

function delay(millisec) {
  return new Promise(resolve => {
    setTimeout(() => { resolve() }, millisec);
  })
}
class Crawler {
  /**
   * Initializes the internal request reactor.
   * @method constructor
   */
  constructor(timeout = 2500, disconnect = true) {
    this.disconnect = disconnect
    this.request = {
      data: {},
      headers: {
        'Content-Type': 'application/json'
      }
    }
    this.connections = new Connections(timeout)
    this.nodes = {}
    this.heights = []
    this.traversalState = {}
  }

  add(peer) {
    if (!NETWORK_P2P_PORT) {
      NETWORK_P2P_PORT = peer.port
    } else {
      if (NETWORK_P2P_PORT !== peer.port) {
        console.error(`${peer.ip} has p2p port at ${peer.port} instead of ${NETWORK_P2P_PORT}`)
      }
    }

    if (!(peer.ip in this.nodes)) {
      this.nodes[peer.ip] = peer
    } else {
      Object.assign(this.nodes[peer.ip], peer)
    }

    if (!(peer.ip in this.traversalState)) {
      this.traversalState[peer.ip] = NOT_VISITED
    }

    if (!this.connections.get(peer.ip)) {
      this.connections.add(peer.ip, peer.port)
    }
  }



  /**
   * Runs a height check on the entire network connected to the initial peer.
   * @method run
   * @param  {object}  peer {ip: [address], port: [4001]}
   * @return {Promise}
   */
  async run() {
    this.startTime = new Date()
    try {
      console.log('... discovering network peers')
      while (true) {
        const unvisitedIp = sample(Object.keys(this.traversalState).filter(ip => this.traversalState[ip] === NOT_VISITED))
        if (!unvisitedIp) break
        await this.discoverPeers(unvisitedIp)
      }
      console.log('... scanning network')
      await this.scanNetwork()
      if (this.disconnect) {
        console.log('... disconnecting from all peers')
        this.connections.disconnectAll()
      }
      await this.addLocationToNodes()
    } catch (err) {
      console.error(err)
    } finally {
      this.endTime = new Date()
    }
  }

  async discoverPeers(ip) {
    return new Promise((resolve, reject) => {
      const connection = this.connections.get(ip)
      if (!connection) {
        console.error(`No connection exists for ${ip}`)
        this.traversalState[ip] = CONNECTION_FAILED
        return resolve()
      }
      connection.emit(
        'p2p.peer.getPeers',
        this.request,
        (err, response) => {
          if (err) {
            console.error(`Error when calling p2p.peer.getPeers on ${ip}: ${err}`)
            this.traversalState[ip] = GET_PEERS_FAILED
            return resolve()
          }

          this.traversalState[ip] = GET_PEERS_SUCCESS

          response.data.map((peer) => {
            this.add({ port: NETWORK_P2P_PORT, ...peer })
          })

          return resolve()
        }
      )
    })
  }

  scanNetwork() {
    const promises = map(this.nodes, (peer) => {
      return new Promise((resolve, reject) => {
        const connection = this.connections.get(peer.ip)
        if (!connection) {
          return resolve()
        }
        connection.emit(
          'p2p.peer.getStatus',
          this.request,
          (err, response) => {
            if (err) {
              console.error(`Error when calling p2p.peer.getStatus on ${peer.ip}: ${err}`)
              return resolve()
            }
            const block = {
              height: response.data.state.header.height,
              id: response.data.state.header.id
            }
            this.heights.push(block)
            Object.assign(peer, response.data)
            Object.assign(peer, block)
            return resolve()
          }
        )
      })
    })

    return Promise.all(promises)
  }

  async addLocationToNodes() {
    for (const node of Object.values(this.nodes)) {
      try {
        const location = await this.fetchLocationFromIp(node.ip)
        this.nodes[node.ip].location = location
        await delay(200)
      } catch (error) {
        console.error(error)
        await delay(20000)
      }
    }
  }

  async fetchLocationFromIp(ip) {
    return new Promise((resolve, reject) => {
      let request = new XMLHttpRequest()

      request.open('GET', `https://ipinfo.io/${ip}/json`)
      request.send()

      request.onreadystatechange = function () {
        if (request.readyState != 4) {
          return
        }

        if (request.status == 200) {
          const json = JSON.parse(request.responseText);
          delete json.ip
          delete json.anycast
          delete json.readme
          resolve(json)
        } else if (request.status == 429) {
          reject(new Error("Too many requests"))
        } else {
          reject(new Error(`Location API failed and returned status ${request.status}: ${request.responseText}`))
        }
      }
    })
  }
}

module.exports = Crawler
