import * as tf from '@tensorflow/tfjs'

export async function serializeModel(model: tf.LayersModel): Promise<unknown> {
  let saved: unknown = null

  await model.save({
    save: async (artifacts) => {
      saved = artifacts
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } }
    },
  })

  return saved
}

export async function deserializeModel(artifacts: unknown): Promise<tf.LayersModel> {
  return tf.loadLayersModel({
    load: async () => artifacts as tf.io.ModelArtifacts,
  })
}
