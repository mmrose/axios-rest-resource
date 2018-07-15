import { AxiosRequestConfig } from 'axios'
import { expect } from 'chai'
import * as moxios from 'moxios'
import { createSandbox, SinonSandbox } from 'sinon'

import {
  AxiosResourceAdditionalProps,
  createAxiosInstanceFactory,
  createAxiosResourceFactory,
  IAxiosResourceRequestConfig
} from './axios'
import {
  IActionMeta,
  IAPIMethodSchema,
  IBuildParams,
  IBuildParamsExtended,
  IResourceDefault,
  ResourceBuilder,
  resourceSchemaDefault
} from './resource'

describe('resource', () => {
  let sinon: SinonSandbox

  beforeEach(() => {
    sinon = createSandbox()
    moxios.install()
  })
  afterEach(() => {
    sinon.restore()
    moxios.uninstall()
  })

  describe(`${ResourceBuilder.constructor.name}`, () => {
    const ignoreRequestConfigKeys: Array<keyof IAxiosResourceRequestConfig> = [
      AxiosResourceAdditionalProps,
      'data',
      'method',
      'url'
    ]
    const resourceBuilderValidate = async (
      axiosConfig: AxiosRequestConfig & { baseURL: string },
      resourceBuilderParams: IBuildParams | IBuildParamsExtended<string>,
      resourceMethodParams: [ IActionMeta<any, any>, AxiosRequestConfig? ]
    ) => {
      moxios.stubRequest(/.*/, {
        responseText: 'OK',
        status: 200
      })
      const createAxiosInstance = createAxiosInstanceFactory(axiosConfig)
      const createAxiosResource = createAxiosResourceFactory(createAxiosInstance)
      const resourceBuilder = new ResourceBuilder(createAxiosResource)
      const spyCreateAxiosResource = sinon.spy((resourceBuilder as any), '_createAxiosResource')
      const resource = resourceBuilder.build(resourceBuilderParams)
      expect(spyCreateAxiosResource.callCount).to.be.equal(1)
      expect(typeof resource).to.be.equal('object')
      const schema = (resourceBuilderParams as IBuildParamsExtended<string>).schema || resourceSchemaDefault
      for (const schemaKey of Object.keys(schema)) {
        const methodSchema = schema[schemaKey]
        expect(resource).to.have.property(schemaKey)
        const resourceMethod = resource[schemaKey as keyof IResourceDefault]
        expect(typeof resourceMethod).be.equal('function')
        const axiosPromise = resourceMethod(...resourceMethodParams)
        expect(axiosPromise instanceof Promise).to.be.equal(true)
        await axiosPromise
        const requestConfigRes = moxios.requests.mostRecent().config as IAxiosResourceRequestConfig
        expect(typeof requestConfigRes).to.be.equal('object')
        expect(requestConfigRes).to.have.property('method', methodSchema.method.toLowerCase())
        const [ action, requestConfig ] = resourceMethodParams
        expect(requestConfigRes).to.have.property('data', action.payload)
        expect(requestConfigRes).to.have.property(AxiosResourceAdditionalProps)
        expect(typeof requestConfigRes[AxiosResourceAdditionalProps]).to.be.equal('object')
        expect(requestConfigRes[AxiosResourceAdditionalProps]).to.have.property('action', action)
        if (requestConfig) {
          for (const requestConfigKey of Object.keys(requestConfig)) {
            if (ignoreRequestConfigKeys.indexOf(requestConfigKey as keyof IAxiosResourceRequestConfig) !== -1) {
              continue
            }
            const requestConfigVal = requestConfig[requestConfigKey as keyof AxiosRequestConfig]
            if (requestConfigKey === 'headers') {
              // requestConfigVal = headers object
              for (const headersKey of Object.keys(requestConfigVal)) {
                const headersVal = requestConfigVal[headersKey]
                expect(requestConfigRes[requestConfigKey]).to.have.property(headersKey, headersVal)
              }
            } else {
              expect(requestConfigRes).to.have.property(requestConfigKey, requestConfigVal)
            }
          }
        }
      }
      return schema
    }
    describe('build', () => {
      it('success: default schema', async () => {
        const baseURL = 'http://localhost:3000'
        const resourceURL = '/resource'
        const action = {
          payload: 'test',
          type: 'ACTION'
        }
        const schemaRes = await resourceBuilderValidate(
          { baseURL },
          { url: resourceURL },
          [ action ]
        )
        expect(schemaRes).to.be.equal(resourceSchemaDefault)
      })

      it('success: custom schema', async () => {
        const baseURL = 'http://localhost:3000'
        const resourceURL = '/resource'
        const action = {
          payload: 'test',
          type: 'ACTION'
        }
        const schema: { [ index: string ]: IAPIMethodSchema } = {
          test: {
            method: 'PUT'
          }
        }
        const schemaRes = await resourceBuilderValidate(
          { baseURL },
          { url: resourceURL, schema },
          [ action ]
        )
        expect(schemaRes).to.be.equal(schema)
      })

      it('success: custom request params', async () => {
        const baseURL = 'http://localhost:3000'
        const resourceURL = '/resource'
        const action = {
          payload: 'test',
          type: 'ACTION'
        }
        const schema: { [ index: string ]: IAPIMethodSchema } = {
          test: {
            method: 'PUT'
          }
        }
        const requestParams: AxiosRequestConfig = {
          headers: {
            test: 'test'
          }
        }
        const schemaRes = await resourceBuilderValidate(
          { baseURL },
          { url: resourceURL, schema },
          [ action, requestParams ]
        )
        expect(schemaRes).to.be.equal(schema)
      })

      it('success: custom request params with ignored keys', async () => {
        const baseURL = 'http://localhost:3000'
        const resourceURL = '/resource'
        const action = {
          payload: 'test',
          type: 'ACTION'
        }
        const schema: { [ index: string ]: IAPIMethodSchema } = {
          test: {
            method: 'PUT'
          }
        }
        const requestParams: IAxiosResourceRequestConfig = {
          data: 'should not be overridden',
          headers: {
            test: 'test'
          },
          method: 'should not be overridden',
          url: 'should not be overridden',
          [AxiosResourceAdditionalProps]: 'should not be overridden' as any
        }
        const schemaRes = await resourceBuilderValidate(
          { baseURL },
          { url: resourceURL, schema },
          [ action, requestParams ]
        )
        expect(schemaRes).to.be.equal(schema)
      })
    })
  })
})
