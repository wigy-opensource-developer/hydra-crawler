const { orderBy } = require('lodash')
const fs = require('fs')
const path = require('path')
const moment = require('moment')

const Crawler = require('./src/crawler')

const report = (crawler) => {
  const blockStats = {}
  const nodeStats = {}
  const versionStats = {}

  const nodes = Object.values(crawler.nodes)
  for (const node of nodes) {
    if (node.height === undefined || node.id === undefined) {
      continue
    }

    if (blockStats[node.height]) {
      blockStats[node.height].count += 1
      blockStats[node.height].ids[node.id] += 1
    } else {
      blockStats[node.height] = {}
      blockStats[node.height].count = 1
      blockStats[node.height].height = node.height
      // todo block ids
      blockStats[node.height].ids = {}
      blockStats[node.height].ids[node.id] = 1
    }

    if (versionStats[node.config.version]) {
      versionStats[node.config.version].count += 1
    } else {
      versionStats[node.config.version] = {
        count: 1,
        version: node.config.version
      }
    }

    if (nodeStats[node.ip]) {
      continue
    } else {
      nodeStats[node.ip] = { 
        ip: node.ip,
        location: node.location,
        version: node.config.version,
        height: node.height
      }
    }
  }

  // Node stats;
  console.log('Individual node stats');
  for (const node of orderBy(Object.values(nodeStats),['ip'],['desc'])) {
    console.log(`\nIP: ${node.ip}`)
    console.log(`Version: ${node.version} at height: ${node.height}`)
    if (node.location) {
      console.log(`Location: ${node.location.city},${node.location.region},${node.location.country}`)
      console.log(`Organization: ${node.location.org}`)
    } else {
      console.log('Could not fetch location data')
    }
  }

  console.log('===========================================')
  console.log(`All nodes: ${Object.keys(crawler.nodes).length}`)
  console.log(`Nodes online: ${crawler.heights.length}`)
  console.log(`Nodes offline: ${Object.keys(crawler.nodes).length - crawler.heights.length}`)

  // height/block stats
  console.log('')
  console.log('Height and block stats:')
  for (const stat of orderBy(Object.values(blockStats), ['height'], ['desc'])) {
    console.log(`  ${stat.height} with ${stat.count} nodes. Block hashes:`)
    for (const hash in stat.ids) {
      console.log(`    - ${hash} (${stat.ids[hash]} nodes)`)
    }
  }

  // version stats
  console.log('')
  console.log('Version stats:')
  for (const stat of orderBy(Object.values(versionStats), ['version'], ['desc'])) {
    console.log(`  - ${stat.version} on ${stat.count} nodes`)
  }

  console.log('------------------------------------------')
  console.log(`Finished scanning in ${new Date() - crawler.startTime}ms`)

  return crawler
}

const main = async () => {
  try {
    const crawler = new Crawler()
    const args = process.argv.slice(2)
    const outputFilename = `${path.basename(args[0], '.json')}-${moment().format('YYYYMMDD-HHmmss')}.json`

    const inputStr = fs.readFileSync(args[0], { encoding: 'utf-8' })
    let input = JSON.parse(inputStr)
    if ('list' in input) {
      input = input.list
    }
    for (const node of input) {
      crawler.add(node)
    }

    await crawler.run()
    await report(crawler)

    const outputStr = JSON.stringify(Object.values(crawler.nodes), undefined, 2)
    fs.writeFileSync(outputFilename, outputStr, { encoding: 'utf-8' })
  } catch (err) {
    console.error(err)
  }
}

main().then(() => {})
