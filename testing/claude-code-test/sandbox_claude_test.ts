import { Sandbox } from 'e2b';




async function main() {
  const sandbox = await Sandbox.create('33mz2agmad58ip0izxbc');

  await sandbox.commands.run(
    "git clone https://github.com/octocat/Hello-World.git",
    {
      onStdout: (data) => {
        console.log(data.toString());
      },
      onStderr: (data) => {
        console.error(data.toString());
      },
    }
  );

  let stderrOutput = "";



  const result = await sandbox.commands.run("claude --version", {
    onStdout: (data) => {
      console.log(data);
    },
    onStderr: (data) => {
      console.log(data);
    },
  });
  console.log(result);

  // Run a simple Claude code command with streaming output
  // Use ANTHROPIC_API_KEY from environment
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  console.log("hej");
  // change to hello-world directory and start claude code agent there
  await sandbox.commands.run(
    `claude -p "hi" --output-format stream-json --verbose -d`,
    {
      onStdout: (data) => {
        process.stdout.write(`[claude code stdout] ${data.toString()}`);
      },
      onStderr: (data) => {
        process.stderr.write(`[claude code stderr] ${data.toString()}`);
      },

      timeoutMs: 600000,
      cwd: "/home/user/Hello-World",
    }
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
