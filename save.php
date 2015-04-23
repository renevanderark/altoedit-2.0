<?php 
	try {
		$file = fopen("out/alto-saved.xml", "w");
		if(!$file) {
			throw new Exception('failed to open file');
		}
		fwrite($file, file_get_contents("php://input"));
		fclose($file);
		header("HTTP/1.1 200 OK");
	} catch (Exception $e) {
		header("HTTP/1.1 500 Internal Server Error");
	}
?>
