import { sandbox } from '@e2b/code-interpreter'

// Your template ID from the previous step
const templateID = '33mz2agmad58ip0izxbc'
// Pass the template ID to the `Sandbox.create` method
const sandbox = await Sandbox.create(templateID)



console.log(execution.stdout)
