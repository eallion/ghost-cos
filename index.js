'use strict'

const COS = require('cos-nodejs-sdk-v5')
const BaseAdapter = require('ghost-storage-base')
const { URL } = require('url')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')

class GhostCOSAdapter extends BaseAdapter {
  constructor(config) {
    super()

    const cfg = config || {}
    console.log('[ghost-cos] adapter loaded, baseUrl:', cfg.baseUrl)

    this.baseParams = {
      Bucket: cfg.Bucket,
      Region: cfg.Region
    }

    this.rawBaseUrl = cfg.baseUrl || ''
    this.basePath = cfg.basePath || '/ghost/content/images/'
    this.rename = cfg.rename || false

    this.cos = new COS({
      SecretId: cfg.SecretId,
      SecretKey: cfg.SecretKey,
      ForcePathStyle: cfg.forcePathStyle || false,
      Timeout: cfg.timeout || 30000
    })
  }

  _normalizeBaseUrl(url) {
    if (!url) return ''
    url = url.trim()
    if (url.match(/^https?:\/\//i)) {
      return url.replace(/\/+$/, '')
    }
    return 'https://' + url.replace(/\/+$/, '')
  }

  _getBaseUrl() {
    return this._normalizeBaseUrl(this.rawBaseUrl)
  }

  async exists(fileName, targetDir) {
    const Key = this._resolveKey(fileName, targetDir)

    return new Promise((resolve) => {
      this.cos.headObject(
        { ...this.baseParams, Key },
        (err, data) => {
          resolve(!!(data && data.statusCode === 200))
        }
      )
    })
  }

  async save(file, targetDir) {
    const Key = this._generateKey(file, targetDir)

    return new Promise((resolve, reject) => {
      this.cos.sliceUploadFile(
        { ...this.baseParams, Key, FilePath: file.path },
        (err, data) => {
          if (err) {
            reject(err)
          } else {
            const baseUrl = this._getBaseUrl()
            const url = baseUrl ? baseUrl + Key : '//' + data.Location
            resolve(url)
          }
        }
      )
    })
  }

  async delete(fileName, targetDir) {
    const Key = this._resolveKey(fileName, targetDir)

    return new Promise((resolve, reject) => {
      this.cos.deleteObject(
        { ...this.baseParams, Key },
        (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve(data.statusCode >= 200 && data.statusCode < 300)
          }
        }
      )
    })
  }

  async read(options) {
    let Key
    try {
      Key = new URL(options.path).pathname
    } catch {
      Key = options.path
    }

    return new Promise((resolve, reject) => {
      this.cos.getObject(
        { ...this.baseParams, Key },
        (err, data) => {
          if (err || data?.error) {
            return reject(new Error(`Could not read image: ${Key}`))
          }
          resolve(data.Body)
        }
      )
    })
  }

  serve() {
    return function customServe(req, res, next) {
      next()
    }
  }

  _resolveKey(fileName, targetDir) {
    if (!fileName) return ''

    if (fileName.startsWith('http://') || fileName.startsWith('https://') || fileName.startsWith('//')) {
      try {
        const url = new URL(fileName, 'http://localhost')
        return url.pathname
      } catch {}
    }

    if (fileName.startsWith('/')) {
      return fileName
    }

    if (targetDir) {
      return ('/' + targetDir + '/' + fileName).replace(/\/+/g, '/')
    }

    return '/' + fileName
  }

  _generateKey(file, targetDir) {
    const date = new Date()
    const YY = date.getFullYear()
    const MM = String(date.getMonth() + 1).padStart(2, '0')

    const ext = path.extname(file.name || '')
    let hash
    try {
      const buf = fs.readFileSync(file.path)
      hash = crypto.createHash('md5').update(buf).digest('hex').substring(0, 12)
    } catch {
      hash = 'unnamed'
    }

    return `${this.basePath}${YY}/${MM}/${hash}${ext}`
  }
}

module.exports = GhostCOSAdapter
exports.default = GhostCOSAdapter