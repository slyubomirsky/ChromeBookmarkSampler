// Copyright (c) 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var folderChain = [];
var index = 1;

// either sends the saved folder chain and index, or receives one from the
// front-end when there's an update
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
 	console.log('receiving');
 	console.log(request);

  	// attached flag false -> send over the folder chain
  	if (!request.attached) {
  		sendResponse({
  			'folderChain' : folderChain, 
  			'index' : index
  		});
  		return;
  	}
  	// sendFlag true -> copy over the passed in chain
  	folderChain = request.folderChain.slice();
  	index = request.index;
  });