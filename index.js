'use strict'

const COS = require('cos-nodejs-sdk-v5')
const BaseAdapter = require('ghost-storage-base')
const { URL } = require('url')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')
const { transliterate } = require('transliteration')

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
    const Key = await this._generateKey(file, targetDir)

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

  async _generateKey(file, targetDir) {
    const date = new Date()
    const YY = date.getFullYear()
    const MM = String(date.getMonth() + 1).padStart(2, '0')
    const dir = `${this.basePath}${YY}/${MM}`

    if (this.rename) {
      const ext = path.extname(file.name || '')
      let hash
      try {
        const buf = fs.readFileSync(file.path)
        hash = crypto.createHash('md5').update(buf).digest('hex').substring(0, 12)
      } catch {
        hash = 'unnamed'
      }
      return `${dir}/${hash}${ext}`
    }

    let name = this._sanitizeName(file.name || 'unnamed')
    const ext = path.extname(name)
    const base = path.basename(name, ext)
    let counter = 1

    while (await this.exists(name, dir.replace(/^\//, ''))) {
      name = `${base}-${counter}${ext}`
      counter++
    }

    return `${dir}/${name}`
  }

  _sanitizeName(name) {
    const CJK_RE = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/
    if (CJK_RE.test(name)) {
      const segments = name.split(/([\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+)/)
      name = segments
        .filter(Boolean)
        .map(seg => CJK_RE.test(seg)
          ? transliterate(seg).replace(/\s+/g, '').toLowerCase()
          : seg)
        .reduce((acc, seg) => {
          if (!acc) return seg
          const safe = /[a-zA-Z0-9]$/.test(acc) && /^[a-zA-Z0-9]/.test(seg)
          return acc + (safe ? '_' : '') + seg
        }, '')
      name = name.replace(/_(?=\.)/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '')
    }
    return name.replace(/[^\w.-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  }
}

module.exports = GhostCOSAdapter
exports.default = GhostCOSAdapter
