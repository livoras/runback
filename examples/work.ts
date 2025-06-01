import { Work } from '../src/work'

(async () => {
    const work = new Work({
        'step1': async (options: any) => {
            return {
                name: options.name
            }
        },
        'step2': async (options: any) => {
            return { result: options }
        },
        'split': async (options: any) => {
            console.log(options, 'split')
            return options.str.split('')
        },
        'every-letter': async (letter: any) => {
            console.log(letter.letter)
            return letter.letter + ' - done'
        }
    }, 'test2.json')

    await work.load()


    await work.step({
        id: 'step1',
        action: 'step1',
        options: {
            name: 'hello world'
        }
    }, false)

    await work.step({
        id: 'step2',
        action: 'step2',
        options: { message: '$ref.step1.name' }
    }, false)

    await work.step({
        id: 'split',
        action: 'split',
        options: {
            str: '$ref.step2.result.message'
        }
    }, false)

    await work.step({
        id: 'every-letter',
        action: 'every-letter',
        each: "$ref.split",
        options: {
            letter: "$ref.$item"
        }
    }, false)

    await work.run({ entry: 'step1', entryOptions: { name: 'It works!??' }, exit: 'split' })
    console.dir(work.lastRun, { depth: null, colors: true })
    // await work.run({ entry: 'split', entryOptions: { str: 'It works too!??' } })
  })()
