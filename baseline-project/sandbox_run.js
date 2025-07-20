import { Sandbox } from 'e2b'

// Create sandbox
const sandbox = await Sandbox.create({
    template:'bslm087lozmkvjz6nwle',
    apiKey: 'e2b_b43fc9e0e3d94d3f820e0ff1ac41b0b70cc57076'
})

const host = sandbox.getHost(3000) 
console.log(`https://${host}`)