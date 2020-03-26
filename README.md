# Introduction

This repo contains an easy setup for building simple dapps on CKB.

It is based off of the following two talks I gave in preparation for an internal hackathon.

Make sure to watch those before going through the code, which will make the code a lot easier to understand.

Here are the links to the videos:
1. [Video 1]()
2. [Video 2]()

And to the slide decks:
1. [Video 1]()
2. [Video 2]()

The app is divided into 3 high level directories:
1. Generator: This is where tx generation code lives (off chain application that interfaces with CKB)
2. Verifier: This is where verification scripts that should be deployed to ckb are stored
3. Shared: This is where the molecule schema file for both verifier and generator code lives, as well as where the automatically generated molecule methods for the generator application is also stored (the molecule methods for verifier are stored in the build folder within the scripts directory)
The `/generator/app` directory contains boilerplate code for setting up an app with the js-sdk. It also provides
some abstractions I have found useful when experimenting with dapp development.

The convenient methods provided by the boilerplate are not optimal. All new scripts in here, both in generator and verification should be treated as Proof of concept and not be used in production, as they have not undergone any auditing.


The ckb-miscellaneous-scripts submodule is a fork with the following modifications
1. Makefile generates molecule schema from local file for easy changes
2. There is another type script called sudt.c that implements the logic of the SUDT standard (similar to simple-udt.c script) but makes more use of molecule
3. There is also a demonstration implementation of type ID

Make sure to [download](https://github.com/nervosnetwork/ckb/blob/develop/docs/get-ckb.md) ckb local node and follow [setup instructions](https://github.com/nervosnetwork/ckb/blob/develop/docs/configure.md) there for creating a local `dev` chain with cli. The boilerplate includes hardcoded values for the genesis issued capacity for ckb v0.26.2. This project was built using that version of CKB.

Inside `ckb.toml`, make sure to add `"info, ckb-script=debug"` to the logger.


# Useful commands
## Molecule
1. To generate molecule schema for generator code: `npm run generate-js-schema`. For verifier code, just `make all-via-docker` with docker in `verifier/ckb-miscellaneous-scripts` repo. The shared schema that both of these use is located at `shared/schema/blockchain.mol`

## Add new verifier script
1. If you add a new c script, make sure to add it to the makefile so that it is actually built
