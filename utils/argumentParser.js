module.exports = (args) => {
	const flags = {}
	let filePath = null

	if (args.length === 3) {
		// nothing but the filePath given
		return { filePath: args[2], flags }
	}

	// drop first two args (node, and app path)
	args.forEach((argVal, ndx) => {
		if (argVal[0] === '-' && argVal[1] === '-') {
			// found flag
			flags[argVal.slice(2)] = true
		} else if (ndx === args.length - 1) {
			// lost position and not a flag so this is our filePath
			filePath = argVal
		} else {
			// hmm something we don't understand
		}
	})

	return {
		filePath,
		flags
	}
}