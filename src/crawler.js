const { map } = require('lodash')
const Connections = require('./peer')

const NOT_VISITED = 0
const VISITED = 1
let NETWORK_P2P_PORT = null

class Crawler {
  /**
   * Initializes the internal request reactor.
   * @method constructor
   */
  constructor (timeout = 2500, disconnect = true, sampleSize = 10) {
    this.disconnect = disconnect
    this.request = {
      data: {},
      headers: {
        'Content-Type': 'application/json'
      }
    }
    this.sampleSize = sampleSize
    this.connections = new Connections(timeout)
  }

  /**
   * Runs a height check on the entire network connected to the initial peer.
   * @method run
   * @param  {object}  peer {ip: [address], port: [4001]}
   * @return {Promise}
   */
  async run (peer) {
    this.nodes = {}
    this.heights = []
    this.traversalState = {}
    this.startTime = new Date()

    NETWORK_P2P_PORT = peer.port

    if (!this.connections.get(peer.ip)) {
      this.connections.add(peer.ip, NETWORK_P2P_PORT)
    }

    try {
      console.log('... discovering network peers')
      await this.discoverPeers(peer)
      console.log('... scanning network')
      await this.scanNetwork()
      if (this.disconnect) {
        console.log('... disconnecting from all peers')
        this.connections.disconnectAll()
      }
    } catch (err) {
      console.error(err)
    }

    return this
  }

  async discoverPeers (currentNode) {
    return new Promise((resolve, reject) => {
      const connection = this.connections.get(currentNode.ip)
      if (!connection) {
        reject(new Error(`No connection exists for ${currentNode.ip}:${currentNode.port}`))
      }
      connection.emit(
        'p2p.peer.getPeers',
        this.request,
        (err, response) => {
          if (err) {
            console.error(`Error when calling p2p.peer.getPeers on ${currentNode.ip}: ${err}`)
            return resolve()
          }

          if (currentNode.ip in this.traversalState) {
            this.traversalState[currentNode.ip] = VISITED
          }

          response.data.map((peer) => {
            if (!(peer.ip in this.nodes)) {
              this.nodes[peer.ip] = peer
            }

            if (!this.connections.get(peer.ip)) {
              this.connections.add(peer.ip, NETWORK_P2P_PORT)
            }
          })

          if (this.traversalState[currentNode.ip] === VISITED) {
            return resolve()
          }

          // note: this is not very efficient on large arrays
          const samplePeers = response.data
            .filter(p => this.traversalState[p.ip] !== VISITED)
            .filter(a => a.ip !== currentNode.ip)
            .map(x => ({ x, r: Math.random() }))
            .sort((a, b) => a.r - b.r)
            .map(a => a.x)
            .slice(0, this.sampleSize)
          const discoverPeers = samplePeers
            .map((peer) => {
              this.traversalState[peer.ip] = NOT_VISITED
              return this.discoverPeers(peer)
            })
          Promise.all(discoverPeers).then(resolve)
        }
      )
    })
  }

  scanNetwork () {
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
            if (peer.height !== block.height) {
              console.log(peer.ip + ' heights: ' + peer.height + '<>' + block.height)
            }
            Object.assign(peer, response.data.config);
            Object.assign(peer, block);
            // peer.height = block.height
            // peer.id = block.id
            return resolve()
          }
        )
      })
    })

    return Promise.all(promises)
  }
}

module.exports = Crawler
